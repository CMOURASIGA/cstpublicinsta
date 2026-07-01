# Especificação Técnica - Evolução do WebApp para Plataforma Multi-Cliente

## 1. Objetivo

Evoluir o WebApp atual de aprovação e publicação no Instagram para uma plataforma única multi-cliente.

Hoje o sistema atende bem a operação de um único cliente. Porém, para permitir que vários clientes usem a mesma ferramenta, será necessário criar uma camada de separação por cliente, garantindo que cada cliente tenha seus próprios usuários, posts, aprovações, histórico, logs, integrações, pastas no Google Drive e configurações de publicação.

A plataforma deve permitir que o administrador principal, Christian, gerencie todos os clientes em uma única aplicação, sem precisar manter um sistema separado para cada cliente.

---

## 2. Visão geral da evolução

A aplicação deverá deixar de funcionar como um sistema mono-cliente e passar a trabalhar com o conceito de `cliente_id` em todas as operações principais.

Cada cliente deverá ter:

- Cadastro próprio na plataforma.
- Usuários vinculados ao cliente.
- Perfis de acesso específicos.
- Posts próprios.
- Histórico próprio.
- Logs próprios.
- Integrações próprias.
- Pasta própria no Google Drive.
- Configuração própria da Meta/Instagram.
- Webhook n8n próprio, quando aplicável.
- Possibilidade futura de personalização visual.

---

## 3. Diagnóstico do modelo atual

O sistema atual possui tabelas operacionais como:

- `usuarios`
- `posts`
- `historico_posts`
- `logs`

E utiliza variáveis de ambiente para integrações como:

```env
GOOGLE_DRIVE_FOLDER_ID
INSTAGRAM_ACCESS_TOKEN
INSTAGRAM_USER_ID
INSTAGRAM_BUSINESS_ID
FACEBOOK_PAGE_ID
N8N_APPROVAL_WEBHOOK_URL
```

Esse modelo funciona para uma única operação, mas não permite isolar clientes diferentes dentro da mesma base.

Para virar plataforma, as informações que hoje são globais precisam ser movidas para uma estrutura por cliente.

---

## 4. Novo conceito principal: Cliente

Criar uma tabela chamada `clientes`.

Cada registro representa uma empresa, marca, loja, projeto, paróquia ou organização que usará a plataforma.

Exemplos:

- EAC Porciúncula
- Desata Assessoria
- Cliente A
- Cliente B
- Loja X

### SQL sugerido

```sql
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO', 'SUSPENSO')),
  logo_url text,
  cor_primaria text,
  cor_secundaria text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
```

### Campos

| Campo | Tipo | Objetivo |
|---|---|---|
| id | uuid | Identificador único do cliente |
| nome | text | Nome do cliente |
| slug | text | Identificação amigável para URL ou filtros |
| status | text | Controla se o cliente está ativo, inativo ou suspenso |
| logo_url | text | URL da logo do cliente |
| cor_primaria | text | Cor principal para personalização futura |
| cor_secundaria | text | Cor secundária para personalização futura |
| criado_em | timestamp | Data de criação |
| atualizado_em | timestamp | Data da última atualização |

---

## 5. Vínculo entre usuários e clientes

A plataforma precisa permitir que um usuário tenha acesso a um ou mais clientes.

Exemplo:

- Christian acessa todos os clientes.
- Um cliente acessa apenas a própria empresa.
- Um social media pode trabalhar para mais de um cliente.
- Um aprovador acessa apenas os posts do cliente dele.

Para isso, criar uma tabela intermediária `cliente_usuarios`.

### SQL sugerido

```sql
create table if not exists cliente_usuarios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  perfil text not null check (perfil in ('SUPER_ADMIN', 'ADMIN_CLIENTE', 'CRIADOR', 'APROVADOR', 'VISUALIZADOR')),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  criado_em timestamptz not null default now(),
  unique (cliente_id, usuario_id)
);
```

### Perfis sugeridos

| Perfil | Objetivo |
|---|---|
| SUPER_ADMIN | Administrador global da plataforma. Acesso a todos os clientes |
| ADMIN_CLIENTE | Administrador de um cliente específico |
| CRIADOR | Pode criar e editar posts |
| APROVADOR | Pode aprovar, rejeitar, agendar e publicar |
| VISUALIZADOR | Pode apenas visualizar informações |

---

## 6. Ajuste na tabela de posts

A tabela `posts` precisa receber o campo `cliente_id`.

### SQL sugerido

```sql
alter table posts
add column if not exists cliente_id uuid references clientes(id);

create index if not exists idx_posts_cliente_id on posts(cliente_id);
create index if not exists idx_posts_cliente_status on posts(cliente_id, status);
```

### Regra obrigatória

Todo post precisa pertencer a um cliente.

Nenhum post deve ser criado sem `cliente_id`.

Todas as consultas de posts precisam filtrar por cliente.

Exemplo:

```sql
select *
from posts
where cliente_id = :cliente_id;
```

---

## 7. Ajuste na tabela de histórico

A tabela `historico_posts` deve receber `cliente_id`.

Mesmo que o histórico já esteja ligado ao post, ter o `cliente_id` facilita consultas, auditoria e relatórios.

### SQL sugerido

```sql
alter table historico_posts
add column if not exists cliente_id uuid references clientes(id);

create index if not exists idx_historico_cliente_id on historico_posts(cliente_id);
```

### Regra obrigatória

Toda ação registrada no histórico deve indicar:

- cliente
- post
- usuário
- ação realizada
- data/hora

---

## 8. Ajuste na tabela de logs

A tabela `logs` deve receber `cliente_id`.

### SQL sugerido

```sql
alter table logs
add column if not exists cliente_id uuid references clientes(id);

create index if not exists idx_logs_cliente_id on logs(cliente_id);
```

### Objetivo

Permitir análise por cliente.

Exemplos:

- Logs do Cliente A
- Logs do Cliente B
- Logs gerais da plataforma
- Erros de publicação por cliente
- Falhas de upload por cliente
- Retornos da API Meta por cliente

---

## 9. Integrações por cliente

Criar a tabela `cliente_integracoes`.

Essa tabela substitui o uso global de algumas variáveis de ambiente relacionadas a Google Drive, Instagram, Facebook Page, Meta Graph API e n8n.

### SQL sugerido

```sql
create table if not exists cliente_integracoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,

  google_drive_folder_id text,
  google_drive_imagens_folder_id text,
  google_drive_videos_folder_id text,
  google_drive_publicados_folder_id text,

  instagram_access_token text,
  instagram_user_id text,
  instagram_business_id text,
  facebook_page_id text,
  graph_api_version text default 'v23.0',

  n8n_approval_webhook_url text,

  modo_operacao text not null default 'SIMULADOR' check (modo_operacao in ('SIMULADOR', 'REAL')),

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  unique (cliente_id)
);
```

### Campos

| Campo | Objetivo |
|---|---|
| cliente_id | Define a qual cliente pertence a integração |
| google_drive_folder_id | Pasta raiz do cliente no Google Drive |
| google_drive_imagens_folder_id | Pasta de imagens |
| google_drive_videos_folder_id | Pasta de vídeos |
| google_drive_publicados_folder_id | Pasta de arquivos publicados |
| instagram_access_token | Token de acesso da conta Meta/Instagram |
| instagram_user_id | ID da conta Instagram |
| instagram_business_id | ID da conta Instagram Business |
| facebook_page_id | ID da página Facebook vinculada |
| graph_api_version | Versão da Graph API |
| n8n_approval_webhook_url | Webhook n8n específico do cliente |
| modo_operacao | Define se está em simulador ou publicação real |

### Atenção sobre segurança

Tokens e credenciais não devem ser expostos no frontend.

O backend pode consultar esses campos, mas a interface não deve retornar o token completo para o usuário.

Recomendação:

- Não exibir tokens completos no painel.
- Exibir apenas status: configurado ou não configurado.
- Armazenar tokens com criptografia, se possível.
- Restringir edição de integrações ao `SUPER_ADMIN`.

---

## 10. O que deve permanecer em variáveis de ambiente globais

Algumas configurações continuam sendo globais da aplicação:

```env
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_URL
MEDIA_URL_SIGNING_SECRET
GEMINI_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

Essas variáveis pertencem à infraestrutura da plataforma, não ao cliente específico.

---

## 11. O que deve deixar de ser global

As seguintes configurações não devem mais ficar apenas no `.env`, pois precisam variar por cliente:

```env
GOOGLE_DRIVE_FOLDER_ID
INSTAGRAM_ACCESS_TOKEN
INSTAGRAM_USER_ID
INSTAGRAM_BUSINESS_ID
FACEBOOK_PAGE_ID
N8N_APPROVAL_WEBHOOK_URL
```

Elas devem ser buscadas na tabela `cliente_integracoes`.

---

## 12. Ajustes necessários no backend

### 12.1 Criar resolução de cliente ativo

Criar uma função central para resolver o cliente ativo da requisição.

Exemplo conceitual:

```ts
async function getActiveCliente(req, usuario) {
  const clienteId = req.headers['x-cliente-id'] || req.query.cliente_id;

  if (!clienteId) {
    throw new Error('Cliente ativo não informado');
  }

  await assertUserHasAccessToCliente(usuario.id, clienteId);

  return clienteId;
}
```

### 12.2 Validar acesso do usuário ao cliente

Criar função:

```ts
async function assertUserHasAccessToCliente(usuarioId, clienteId) {
  const acesso = await buscarClienteUsuario(usuarioId, clienteId);

  if (!acesso || acesso.status !== 'ATIVO') {
    throw new Error('Usuário sem acesso ao cliente informado');
  }

  return acesso;
}
```

### 12.3 Validar permissão por ação

Criar função:

```ts
function assertCan(perfil, acao) {
  // Exemplo:
  // CRIADOR pode criar post
  // APROVADOR pode aprovar
  // ADMIN_CLIENTE pode gerenciar usuários do cliente
  // SUPER_ADMIN pode tudo
}
```

---

## 13. Ajustes nas funções de posts

### Antes

```ts
listPosts()
getPostById(id)
createPostRecord(payload)
updatePostRecord(id, payload)
```

### Depois

```ts
listPosts(clienteId)
getPostById(clienteId, postId)
createPostRecord(clienteId, payload)
updatePostRecord(clienteId, postId, payload)
```

### Regra

Nunca buscar post apenas por `id`.

Sempre buscar por:

```sql
where id = :post_id
and cliente_id = :cliente_id
```

Isso evita que um cliente acesse post de outro cliente.

---

## 14. Ajustes no histórico

### Antes

```ts
createHistoryRecord(payload)
```

### Depois

```ts
createHistoryRecord(clienteId, payload)
```

### Payload esperado

```json
{
  "cliente_id": "...",
  "post_id": "...",
  "usuario_id": "...",
  "acao": "POST_APROVADO",
  "detalhes": {}
}
```

---

## 15. Ajustes nos logs

### Antes

```ts
addLog(service, message, payload)
```

### Depois

```ts
addLog(clienteId, service, message, payload)
```

### Exemplo

```json
{
  "cliente_id": "...",
  "service": "instagram",
  "message": "Post publicado com sucesso",
  "payload": {
    "post_id": "...",
    "instagram_media_id": "..."
  }
}
```

---

## 16. Ajustes no Google Drive

Hoje o sistema usa uma pasta global do Google Drive.

Na nova versão, o backend precisa buscar a pasta do cliente ativo.

### Antes

```ts
const folderId = config.googleDriveFolderId;
```

### Depois

```ts
const integracao = await getClienteIntegracao(clienteId);
const folderId = integracao.google_drive_folder_id;
```

### Estrutura recomendada

Cada cliente deve ter uma pasta raiz própria.

Exemplo:

```text
/Clientes
  /Desata Assessoria
    /Imagens
    /Videos
    /Publicados
  /EAC Porciúncula
    /Imagens
    /Videos
    /Publicados
```

Ou:

```text
Cliente A -> google_drive_folder_id específico
Cliente B -> google_drive_folder_id específico
Cliente C -> google_drive_folder_id específico
```

### Funções que devem mudar

```ts
ensureDriveFolders(clienteId)
uploadMediaToDrive(clienteId, file)
moveMediaToPublished(clienteId, fileId)
getDrivePublicUrl(clienteId, fileId)
```

---

## 17. Ajustes na publicação Instagram

Hoje o sistema usa configuração global da Meta.

Na nova versão, deve buscar a integração do cliente dono do post.

### Antes

```ts
const accessToken = config.instagramAccessToken;
const instagramUserId = config.instagramUserId;
```

### Depois

```ts
const integracao = await getClienteIntegracao(post.cliente_id);

const accessToken = integracao.instagram_access_token;
const instagramUserId = integracao.instagram_user_id;
const instagramBusinessId = integracao.instagram_business_id;
const facebookPageId = integracao.facebook_page_id;
```

### Regra obrigatória

A publicação deve sempre usar as credenciais do cliente dono do post.

Não pode haver publicação usando token global quando o sistema estiver em modo multi-cliente.

---

## 18. Ajustes no webhook n8n

Hoje existe um webhook global.

Na nova versão, o webhook deve ser por cliente.

### Antes

```ts
const webhookUrl = config.n8nApprovalWebhookUrl;
```

### Depois

```ts
const integracao = await getClienteIntegracao(clienteId);
const webhookUrl = integracao.n8n_approval_webhook_url;
```

### Payload recomendado

```json
{
  "event": "post_pending_approval",
  "cliente": {
    "id": "...",
    "nome": "Desata Assessoria"
  },
  "post": {
    "id": "...",
    "titulo": "...",
    "status": "PENDENTE_APROVACAO",
    "caption": "...",
    "media_url": "..."
  },
  "usuario": {
    "id": "...",
    "nome": "..."
  },
  "created_at": "..."
}
```

---

## 19. Ajustes no frontend

### 19.1 Criar seletor de cliente ativo

Adicionar seletor no topo do sistema.

Exemplo:

```text
Cliente ativo: Desata Assessoria
```

Regras:

- `SUPER_ADMIN` vê todos os clientes.
- Usuário comum vê apenas os clientes aos quais tem acesso.
- Usuário com apenas um cliente pode entrar direto sem precisar selecionar.
- Ao trocar o cliente ativo, todo o painel deve recarregar dados daquele cliente.

### 19.2 Criar tela de Clientes

Tela visível apenas para `SUPER_ADMIN`.

Funcionalidades:

- Listar clientes.
- Criar cliente.
- Editar cliente.
- Inativar cliente.
- Suspender cliente.
- Visualizar status.
- Acessar configurações do cliente.
- Acessar usuários do cliente.

Campos mínimos:

- Nome
- Slug
- Status
- Logo
- Cor primária
- Cor secundária

### 19.3 Ajustar tela de Usuários

A tela de usuários precisa permitir gerenciar usuários por cliente.

Funcionalidades:

- Listar usuários do cliente ativo.
- Vincular usuário existente ao cliente.
- Criar novo usuário para o cliente.
- Definir perfil do usuário no cliente.
- Inativar acesso do usuário ao cliente.
- Remover acesso do usuário ao cliente.

### 19.4 Ajustar tela de Configurações

A tela de configurações deve exibir dados do cliente ativo.

Exemplo:

```text
Cliente ativo: Desata Assessoria

Google Drive: configurado
Instagram: configurado
Facebook Page: configurado
Webhook n8n: configurado
Modo de operação: REAL
```

Não exibir tokens completos.

### 19.5 Ajustar Dashboard

O dashboard deve mostrar apenas dados do cliente ativo.

Exemplos de indicadores:

- Posts em rascunho
- Posts pendentes de aprovação
- Posts aprovados
- Posts agendados
- Posts publicados
- Posts rejeitados
- Erros de publicação
- Publicações do mês

Para `SUPER_ADMIN`, pode existir uma visão global futura.

---

## 20. Regras de segurança obrigatórias

O backend deve impedir acesso cruzado entre clientes.

### Regras

1. Usuário só pode acessar cliente ao qual está vinculado.
2. Usuário só pode ver posts do cliente ativo.
3. Usuário só pode aprovar posts do cliente ativo.
4. Usuário só pode publicar posts do cliente ativo.
5. Usuário só pode ver histórico do cliente ativo.
6. Usuário só pode ver logs do cliente ativo.
7. Integrações só podem ser usadas pelo cliente correspondente.
8. O frontend não deve ser a única barreira de segurança.
9. Toda API deve validar `cliente_id` no backend.
10. Em caso de acesso indevido, retornar `403` ou `404`.

### Exemplo de proteção

Requisição inválida:

```text
Usuário do Cliente A tenta acessar post do Cliente B
```

Resposta esperada:

```text
403 - Sem permissão
```

ou

```text
404 - Post não encontrado
```

---

## 21. Status sugeridos para posts

Manter ou padronizar os status de posts.

Sugestão:

```text
RASCUNHO
PENDENTE_APROVACAO
APROVADO
REJEITADO
AGENDADO
PUBLICADO
ERRO_PUBLICACAO
CANCELADO
```

### Fluxo principal

```text
RASCUNHO
   ↓
PENDENTE_APROVACAO
   ↓
APROVADO
   ↓
AGENDADO ou PUBLICADO
```

### Fluxo de rejeição

```text
PENDENTE_APROVACAO
   ↓
REJEITADO
   ↓
RASCUNHO
```

### Fluxo de erro

```text
APROVADO ou AGENDADO
   ↓
ERRO_PUBLICACAO
```

---

## 22. Fases recomendadas de desenvolvimento

Não implementar tudo de uma vez. Seguir por fases reduz risco.

---

### Fase 1 - Estrutura multi-cliente no banco

Implementar:

- Criar tabela `clientes`.
- Criar tabela `cliente_usuarios`.
- Criar tabela `cliente_integracoes`.
- Adicionar `cliente_id` em `posts`.
- Adicionar `cliente_id` em `historico_posts`.
- Adicionar `cliente_id` em `logs`.
- Criar índices necessários.

Critério de aceite:

- É possível cadastrar mais de um cliente.
- É possível vincular usuários a clientes.
- Posts passam a pertencer a um cliente.
- Histórico e logs passam a identificar cliente.

---

### Fase 2 - Contexto de cliente no backend

Implementar:

- Resolver cliente ativo por requisição.
- Validar acesso do usuário ao cliente.
- Adaptar consultas de posts para `cliente_id`.
- Adaptar criação de posts para `cliente_id`.
- Adaptar atualização de posts para validar cliente.
- Adaptar histórico para gravar `cliente_id`.
- Adaptar logs para gravar `cliente_id`.

Critério de aceite:

- Usuário de um cliente não vê posts de outro.
- APIs não retornam dados cruzados.
- Toda criação de post exige cliente ativo.
- Logs e histórico ficam separados por cliente.

---

### Fase 3 - Seletor de cliente no frontend

Implementar:

- Listar clientes permitidos para o usuário logado.
- Criar seletor de cliente ativo.
- Persistir cliente ativo na sessão/localStorage ou estado global.
- Enviar cliente ativo nas chamadas para API.
- Recarregar dashboard e listas ao trocar cliente.

Critério de aceite:

- `SUPER_ADMIN` consegue alternar entre clientes.
- Usuário comum vê apenas seus clientes.
- Ao trocar cliente, posts e indicadores mudam corretamente.

---

### Fase 4 - Gestão de usuários por cliente

Implementar:

- Tela de usuários do cliente ativo.
- Vincular usuário ao cliente.
- Criar usuário já vinculado ao cliente.
- Alterar perfil do usuário no cliente.
- Inativar vínculo do usuário com cliente.

Critério de aceite:

- Cada cliente tem sua própria lista de usuários.
- Um usuário pode estar em mais de um cliente.
- Perfil do usuário pode ser diferente em cada cliente.

---

### Fase 5 - Integrações por cliente

Implementar:

- Tela de configurações por cliente.
- Cadastro de pasta Google Drive por cliente.
- Cadastro de credenciais Meta/Instagram por cliente.
- Cadastro de webhook n8n por cliente.
- Buscar integração por `cliente_id` no backend.

Critério de aceite:

- Cliente A usa sua própria pasta Google Drive.
- Cliente B usa outra pasta Google Drive.
- Cliente A publica no Instagram A.
- Cliente B publica no Instagram B.
- Webhook n8n é chamado de acordo com o cliente.

---

### Fase 6 - Ajuste do fluxo completo de publicação

Implementar:

- Upload de mídia usando pasta do cliente.
- Geração/validação de mídia vinculada ao cliente.
- Envio para aprovação dentro do cliente.
- Aprovação/rejeição dentro do cliente.
- Publicação Instagram usando integração do cliente.
- Histórico e logs por cliente.
- Movimentação para pasta de publicados do cliente.

Critério de aceite:

- Um post criado no Cliente A nunca aparece no Cliente B.
- Publicação do Cliente A usa credenciais do Cliente A.
- Logs da publicação aparecem no Cliente A.
- Histórico da aprovação aparece no Cliente A.

---

### Fase 7 - Personalização visual por cliente

Implementar depois das fases principais.

Possibilidades:

- Logo do cliente no painel.
- Nome do cliente em destaque.
- Cor primária.
- Cor secundária.
- Pequena customização do ambiente.

Critério de aceite:

- Ao selecionar um cliente, a interface pode exibir a identidade dele.
- A personalização não afeta segurança nem dados.

---

## 23. Telas necessárias

### Tela: Clientes

Visível para:

- `SUPER_ADMIN`

Funções:

- Criar cliente.
- Editar cliente.
- Inativar cliente.
- Suspender cliente.
- Abrir configurações.
- Abrir usuários.
- Abrir dashboard do cliente.

---

### Tela: Usuários do Cliente

Visível para:

- `SUPER_ADMIN`
- `ADMIN_CLIENTE`, se permitido

Funções:

- Listar usuários vinculados.
- Criar usuário.
- Vincular usuário existente.
- Alterar perfil.
- Inativar usuário no cliente.

---

### Tela: Configurações do Cliente

Visível para:

- `SUPER_ADMIN`
- `ADMIN_CLIENTE`, se permitido

Funções:

- Configurar Google Drive.
- Configurar Meta/Instagram.
- Configurar webhook n8n.
- Definir modo simulador ou real.
- Verificar status das integrações.

---

### Tela: Dashboard

Visível para usuários autorizados.

Funções:

- Exibir indicadores do cliente ativo.
- Exibir posts por status.
- Exibir erros recentes.
- Exibir próximas publicações.

---

### Tela: Posts

Ajustar tela atual para:

- Filtrar por cliente ativo.
- Criar post para cliente ativo.
- Aprovar post do cliente ativo.
- Publicar post do cliente ativo.
- Ver histórico do cliente ativo.

---

## 24. Permissões por perfil

| Ação | SUPER_ADMIN | ADMIN_CLIENTE | CRIADOR | APROVADOR | VISUALIZADOR |
|---|---|---|---|---|---|
| Criar cliente | Sim | Não | Não | Não | Não |
| Editar cliente | Sim | Não | Não | Não | Não |
| Inativar cliente | Sim | Não | Não | Não | Não |
| Gerenciar integrações | Sim | Opcional | Não | Não | Não |
| Gerenciar usuários do cliente | Sim | Sim | Não | Não | Não |
| Criar post | Sim | Sim | Sim | Opcional | Não |
| Editar rascunho | Sim | Sim | Sim | Não | Não |
| Enviar para aprovação | Sim | Sim | Sim | Não | Não |
| Aprovar post | Sim | Sim | Não | Sim | Não |
| Rejeitar post | Sim | Sim | Não | Sim | Não |
| Agendar post | Sim | Sim | Não | Sim | Não |
| Publicar post | Sim | Sim | Não | Sim | Não |
| Ver histórico | Sim | Sim | Opcional | Sim | Sim |
| Ver logs | Sim | Opcional | Não | Não | Não |

---

## 25. Migração dos dados atuais

Como o sistema atual já tem dados, será necessário criar um cliente inicial para receber os dados existentes.

### Exemplo

Criar cliente:

```sql
insert into clientes (nome, slug, status)
values ('Cliente Inicial', 'cliente-inicial', 'ATIVO')
returning id;
```

Depois atualizar dados existentes:

```sql
update posts
set cliente_id = '<ID_DO_CLIENTE_INICIAL>'
where cliente_id is null;

update historico_posts
set cliente_id = '<ID_DO_CLIENTE_INICIAL>'
where cliente_id is null;

update logs
set cliente_id = '<ID_DO_CLIENTE_INICIAL>'
where cliente_id is null;
```

Depois vincular usuários existentes:

```sql
insert into cliente_usuarios (cliente_id, usuario_id, perfil, status)
select '<ID_DO_CLIENTE_INICIAL>', id, 'SUPER_ADMIN', 'ATIVO'
from usuarios
where email = 'EMAIL_DO_ADMIN';
```

Atenção: ajustar o perfil conforme os usuários existentes.

---

## 26. Critérios gerais de aceite

A entrega será considerada correta quando:

1. O sistema permitir cadastrar múltiplos clientes.
2. O sistema permitir vincular usuários a clientes.
3. O usuário só visualizar clientes permitidos.
4. O usuário só visualizar posts do cliente ativo.
5. O usuário não conseguir acessar post de outro cliente pela URL ou API.
6. O histórico ficar separado por cliente.
7. Os logs ficarem separados por cliente.
8. Google Drive for configurado por cliente.
9. Instagram/Meta for configurado por cliente.
10. Webhook n8n for configurado por cliente.
11. O painel permitir alternar cliente ativo.
12. A publicação usar sempre as credenciais do cliente dono do post.
13. O sistema manter o fluxo atual de criação, aprovação e publicação.
14. O sistema não exigir uma instalação separada por cliente.
15. O `SUPER_ADMIN` conseguir gerenciar todos os clientes.

---

## 27. Riscos de implementação

### Risco 1 - Vazamento de dados entre clientes

Mitigação:

- Validar `cliente_id` no backend.
- Nunca confiar apenas no filtro do frontend.
- Toda busca por post deve usar `id` + `cliente_id`.

### Risco 2 - Publicar no Instagram errado

Mitigação:

- Buscar integração pelo `cliente_id` do post.
- Registrar no log qual conta foi usada.
- Exibir confirmação antes de publicação real.

### Risco 3 - Token exposto no frontend

Mitigação:

- Não retornar token completo.
- Mascarar campos sensíveis.
- Permitir edição apenas para `SUPER_ADMIN`.

### Risco 4 - Migração quebrar posts antigos

Mitigação:

- Criar cliente inicial.
- Associar todos os dados atuais a esse cliente.
- Testar antes em ambiente de homologação.

### Risco 5 - Aumento de complexidade no frontend

Mitigação:

- Criar contexto global de cliente ativo.
- Centralizar chamadas de API.
- Evitar passar `cliente_id` manualmente em cada componente de forma solta.

---

## 28. Ordem prática de execução para o dev

Executar nesta ordem:

1. Criar tabelas novas.
2. Adicionar `cliente_id` nas tabelas existentes.
3. Criar cliente inicial.
4. Migrar posts, histórico e logs existentes.
5. Criar vínculo dos usuários existentes com o cliente inicial.
6. Criar funções backend para resolver cliente ativo.
7. Proteger APIs com validação de cliente.
8. Ajustar listagem de posts.
9. Ajustar criação de posts.
10. Ajustar atualização/aprovação/publicação de posts.
11. Criar seletor de cliente no frontend.
12. Criar tela de clientes.
13. Criar tela de usuários por cliente.
14. Criar tela de integrações por cliente.
15. Mover Google Drive para configuração por cliente.
16. Mover Meta/Instagram para configuração por cliente.
17. Mover webhook n8n para configuração por cliente.
18. Testar cliente A e cliente B com dados separados.
19. Testar publicação real em ambiente controlado.
20. Validar logs, histórico e segurança.

---

## 29. Resultado esperado

Ao final do desenvolvimento, a aplicação deverá funcionar como uma plataforma única de aprovação e publicação.

Christian poderá cadastrar vários clientes e gerenciar todos em uma única base.

Cada cliente terá sua própria operação isolada:

- Seus usuários.
- Seus posts.
- Seus aprovadores.
- Suas mídias.
- Seu Google Drive.
- Seu Instagram.
- Seus logs.
- Seu histórico.

O sistema atual será preservado, mas evoluído para suportar escala comercial e uso por múltiplos clientes.

---

## 30. Observação final

A recomendação é não transformar imediatamente em uma plataforma aberta para cadastro automático de qualquer cliente.

A primeira versão deve ser uma plataforma multi-cliente gerenciada pelo administrador principal.

Modelo sugerido:

```text
Christian cadastra o cliente.
Christian configura as integrações.
Christian libera os usuários.
O cliente usa o sistema apenas dentro do ambiente dele.
```

Depois, em uma fase futura, pode ser criado onboarding automatizado, cobrança, planos e autosserviço.
