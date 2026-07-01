# Especificação Técnica - Módulo de Parametrizações da Plataforma Multi-Cliente

## 1. Objetivo

Implementar um módulo de parametrizações separado por escopo dentro da plataforma multi-cliente.

Hoje a plataforma apresenta configurações misturadas em uma única visão, incluindo parâmetros do sistema, parâmetros de cliente, dados de integração, modelo de IA e informações técnicas sensíveis.

A evolução necessária é separar claramente:

1. Parametrizações globais do sistema
2. Parametrizações específicas do cliente
3. Parametrizações de integrações do cliente
4. Parametrizações de IA do cliente
5. Parametrizações de aprovação e operação
6. Parametrizações sensíveis e segredos
7. Auditoria das alterações

Essa separação permitirá que a plataforma seja operada profissionalmente, com segurança, organização e possibilidade comercial de vender implantação, configuração assistida e suporte técnico por cliente.

---

## 2. Visão geral da necessidade

A plataforma será usada por vários clientes dentro da mesma base.

Por isso, é obrigatório diferenciar o que pertence à plataforma como um todo e o que pertence a cada cliente.

Exemplo:

```text
APP_URL pertence ao sistema.
SUPABASE_URL pertence ao sistema.
INSTAGRAM_GRAPH_BASE_URL pertence ao sistema.
PASTA_RAIZ_GOOGLE_DRIVE pertence ao cliente.
INSTAGRAM_ACTOR_ID pertence ao cliente.
FACEBOOK_PAGE_ID pertence ao cliente.
MODELO_IA pertence ao cliente.
TOKEN_META pertence ao cliente, mas é um segredo sensível.
```

A interface não deve misturar tudo na mesma tela, porque isso aumenta risco técnico, gera confusão para o cliente e dificulta a venda de implantação.

---

## 3. Princípio central

A plataforma deve trabalhar com dois níveis principais de parametrização:

```text
Configuração global do sistema
Configuração específica do cliente
```

Além disso, alguns parâmetros específicos do cliente podem sobrescrever parâmetros globais.

Exemplo:

```text
Graph API Version global: v23.0
Cliente A usa padrão global v23.0
Cliente B usa configuração própria v24.0
```

Essa lógica deve ser chamada de fallback de configuração.

---

## 4. Classificação dos parâmetros

### 4.1 Parâmetros globais do sistema

São parâmetros necessários para a plataforma funcionar.

Devem ser gerenciados somente pelo `SUPER_ADMIN`.

Exemplos:

```text
APP_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
INSTAGRAM_GRAPH_BASE_URL
GRAPH_API_VERSION padrão
MEDIA_URL_SIGNING_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
Configuração global de autenticação
Configuração global de storage
Configuração global de logs
Configuração global de e-mail
Configuração global de segurança
Provedor de IA padrão da plataforma
Modelo de IA padrão da plataforma
Política global de limites
```

### 4.2 Parâmetros específicos do cliente

São parâmetros que pertencem a um cliente específico.

Exemplos:

```text
Nome do cliente
Slug
Status do cliente
Logo
Cor primária
Cor secundária
Pasta raiz Google Drive
Instagram Actor ID
Instagram Business ID
Facebook Page ID
Token Meta
Webhook n8n
Modelo de IA escolhido
Prompt base do cliente
Tom de voz
Regras de conteúdo
Modo de operação
Usuários do cliente
Aprovadores
Regras de aprovação
```

### 4.3 Parâmetros sensíveis

São valores que nunca devem ser expostos integralmente no frontend.

Exemplos:

```text
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
INSTAGRAM_ACCESS_TOKEN
META_ACCESS_TOKEN
GEMINI_API_KEY
OPENAI_API_KEY
AZURE_OPENAI_API_KEY
ANTHROPIC_API_KEY
MISTRAL_API_KEY
WEBHOOK_SECRET
MEDIA_URL_SIGNING_SECRET
```

Esses parâmetros podem ser globais ou de cliente, mas devem seguir regras especiais de segurança.

---

## 5. Classificação prática da tela atual

A tela atual mostra os seguintes campos.

| Campo | Classificação correta | Observação |
|---|---|---|
| APP_URL | Sistema | Global da plataforma |
| GRAPH API VERSION | Sistema com override por cliente | Valor padrão global, mas pode ser sobrescrito |
| SUPABASE URL | Sistema | Nunca deve ser parametrização do cliente |
| PASTA RAIZ GOOGLE DRIVE | Cliente | Cada cliente pode ter sua própria pasta |
| INSTAGRAM ACTOR ID | Cliente | Pertence à conta Instagram do cliente |
| INSTAGRAM GRAPH BASE URL | Sistema | Deve ser padrão global |
| FACEBOOK PAGE ID | Cliente | Pertence à página do cliente |
| GEMINI MODEL | Cliente ou padrão global | Cliente pode escolher modelo próprio |
| ARMAZENAMENTO DE SEGREDOS | Sistema | Define política técnica da plataforma |

---

## 6. Estrutura de menus recomendada

### 6.1 Menu do SUPER_ADMIN

```text
Dashboard Global
Clientes
Usuários Globais
Configurações do Sistema
Logs Globais
Planos e Limites
Help Center
Sair
```

### 6.2 Menu dentro de um cliente

```text
Resumo do Cliente
Postagens
Usuários
Integrações
Inteligência Artificial
Regras de Aprovação
Branding
Logs do Cliente
Configurações do Cliente
```

### 6.3 Menu do ADMIN_CLIENTE

```text
Dashboard
Postagens
Usuários
Integrações
Inteligência Artificial
Regras de Aprovação
Branding
Logs
Help Center
Sair
```

A exibição dos menus deve respeitar permissões e plano contratado.

---

## 7. Telas que devem ser criadas ou ajustadas

### 7.1 Configurações do Sistema

Rota sugerida:

```text
/admin/configuracoes/sistema
```

Acesso:

```text
SUPER_ADMIN
```

Objetivo:

Gerenciar parâmetros globais da plataforma.

Seções sugeridas:

```text
Geral
Banco de dados
Meta/Instagram global
Google OAuth global
IA padrão da plataforma
Segurança
Armazenamento de segredos
E-mail e notificações
Logs
Limites globais
```

Campos sugeridos:

```text
APP_URL
SUPABASE_URL
INSTAGRAM_GRAPH_BASE_URL
GRAPH_API_VERSION_DEFAULT
GOOGLE_CLIENT_ID
GOOGLE_REDIRECT_URI
DEFAULT_AI_PROVIDER
DEFAULT_AI_MODEL
SECRET_STORAGE_MODE
LOG_RETENTION_DAYS
DEFAULT_RATE_LIMIT
```

Importante:

Valores sensíveis não devem ser exibidos integralmente.

---

### 7.2 Configurações do Cliente

Rota sugerida:

```text
/admin/clientes/:clienteId/configuracoes
```

ou, no contexto do cliente:

```text
/app/configuracoes
```

Acesso:

```text
SUPER_ADMIN
ADMIN_CLIENTE, se permitido
```

Objetivo:

Gerenciar parâmetros operacionais do cliente.

Seções sugeridas:

```text
Dados do cliente
Branding
Operação
Publicação
Aprovação
Notificações
Limites
```

Campos sugeridos:

```text
Nome do cliente
Slug
Status
Logo
Cor primária
Cor secundária
Fuso horário
Idioma padrão
Modo de operação
Permite publicação automática
Exige aprovação antes de publicar
Número mínimo de aprovadores
Notificar aprovador por e-mail
Notificar aprovador por WhatsApp/n8n
Limite mensal de posts
Limite mensal de uso de IA
```

---

### 7.3 Integrações do Cliente

Rota sugerida:

```text
/admin/clientes/:clienteId/integracoes
```

ou:

```text
/app/integracoes
```

Acesso:

```text
SUPER_ADMIN
ADMIN_CLIENTE, se permitido
```

Objetivo:

Configurar integrações necessárias para publicação e automação.

Seções:

```text
Google Drive
Meta/Instagram
n8n
Webhooks
Armazenamento
```

Campos Google Drive:

```text
Pasta raiz Google Drive
Pasta de imagens
Pasta de vídeos
Pasta de publicados
Status da conexão
Última sincronização
```

Campos Meta/Instagram:

```text
Instagram Actor ID
Instagram User ID
Instagram Business ID
Facebook Page ID
Access Token Meta
Graph API Version override
Status da conexão
Expiração do token
Último teste de conexão
```

Campos n8n:

```text
Webhook aprovação
Webhook publicação
Webhook erro
Webhook secret
Status do webhook
Último ping
```

---

### 7.4 Inteligência Artificial do Cliente

Rota sugerida:

```text
/admin/clientes/:clienteId/ia
```

ou:

```text
/app/ia
```

Acesso:

```text
SUPER_ADMIN
ADMIN_CLIENTE, se permitido
```

Objetivo:

Permitir que cada cliente escolha seu provedor e modelo de IA.

Campos:

```text
Provedor de IA
Modelo principal
Modelo fallback
Chave de API
Base URL, quando aplicável
Deployment Azure, quando aplicável
Temperatura
Máximo de tokens
Prompt base do cliente
Tom de voz
Regras de conteúdo
Habilitar fallback
Habilitar análise de imagem
Habilitar JSON mode
Limite diário de requisições
Limite mensal de custo
```

Essa tela deve seguir a especificação de IA configurável por cliente.

---

### 7.5 Regras de Aprovação do Cliente

Rota sugerida:

```text
/admin/clientes/:clienteId/regras-aprovacao
```

ou:

```text
/app/regras-aprovacao
```

Acesso:

```text
SUPER_ADMIN
ADMIN_CLIENTE
```

Objetivo:

Permitir que cada cliente tenha sua regra de aprovação.

Campos sugeridos:

```text
Exigir aprovação antes de publicar
Permitir publicação direta por aprovador
Permitir publicação direta por admin
Número mínimo de aprovações
Permitir rejeição com justificativa obrigatória
Permitir agendamento sem aprovação
Notificar aprovadores ao receber post
Notificar criador quando aprovado
Notificar criador quando rejeitado
Tempo limite para aprovação
Ação após tempo limite
```

Exemplo de regras:

```text
Cliente A exige 1 aprovação.
Cliente B exige 2 aprovações.
Cliente C permite publicação direta por ADMIN_CLIENTE.
Cliente D exige justificativa em toda rejeição.
```

---

### 7.6 Logs de Alterações de Parâmetros

Rota sugerida:

```text
/admin/logs/parametros
```

ou:

```text
/admin/clientes/:clienteId/logs-parametros
```

Objetivo:

Auditar todas as alterações de configuração.

Campos do log:

```text
Data
Usuário
Cliente
Escopo
Parâmetro alterado
Valor anterior mascarado
Valor novo mascarado
Origem da alteração
IP, se disponível
User Agent, se disponível
```

---

## 8. Modelo de banco recomendado

### 8.1 Tabela sistema_configuracoes

Guarda parâmetros globais da plataforma.

```sql
create table if not exists sistema_configuracoes (
  id uuid primary key default gen_random_uuid(),

  chave text not null unique,
  valor text,
  valor_encrypted text,

  tipo text not null default 'STRING' check (
    tipo in ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET')
  ),

  categoria text not null default 'GERAL',

  descricao text,
  sensivel boolean not null default false,
  editavel boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
```

Exemplos de registros:

```sql
insert into sistema_configuracoes (chave, valor, tipo, categoria, descricao, sensivel)
values
('APP_URL', 'https://webapppublicinsta.vercel.app', 'STRING', 'GERAL', 'URL pública da aplicação', false),
('INSTAGRAM_GRAPH_BASE_URL', 'https://graph.instagram.com', 'STRING', 'META', 'Base URL da Instagram Graph API', false),
('GRAPH_API_VERSION_DEFAULT', 'v23.0', 'STRING', 'META', 'Versão padrão da Graph API', false),
('SECRET_STORAGE_MODE', 'BACKEND_ONLY', 'STRING', 'SEGURANCA', 'Modo de armazenamento de segredos', false);
```

---

### 8.2 Tabela cliente_configuracoes

Guarda parâmetros específicos de cada cliente.

```sql
create table if not exists cliente_configuracoes (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid not null references clientes(id) on delete cascade,

  chave text not null,
  valor text,
  valor_encrypted text,

  tipo text not null default 'STRING' check (
    tipo in ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET')
  ),

  categoria text not null default 'GERAL',

  descricao text,
  sensivel boolean not null default false,
  editavel_por_cliente boolean not null default false,

  usar_padrao_sistema boolean not null default false,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  unique (cliente_id, chave)
);
```

Exemplos de registros:

```sql
insert into cliente_configuracoes (
  cliente_id,
  chave,
  valor,
  tipo,
  categoria,
  descricao,
  sensivel,
  editavel_por_cliente
)
values
('<CLIENTE_ID>', 'MODO_OPERACAO', 'SIMULADOR', 'STRING', 'OPERACAO', 'Define se o cliente opera em simulador ou real', false, false),
('<CLIENTE_ID>', 'EXIGE_APROVACAO', 'true', 'BOOLEAN', 'APROVACAO', 'Define se posts precisam de aprovação', false, true),
('<CLIENTE_ID>', 'LIMITE_POSTS_MES', '100', 'NUMBER', 'LIMITES', 'Limite mensal de posts', false, false);
```

---

### 8.3 Tabela cliente_integracoes

Esta tabela já foi prevista na especificação multi-cliente, mas deve ser usada como parte do módulo de parametrização.

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
  graph_api_version text,

  n8n_approval_webhook_url text,
  n8n_publish_webhook_url text,
  n8n_error_webhook_url text,
  webhook_secret_encrypted text,

  modo_operacao text not null default 'SIMULADOR' check (modo_operacao in ('SIMULADOR', 'REAL')),

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  unique (cliente_id)
);
```

Observação:

O campo `graph_api_version` deve ser opcional. Se estiver vazio, usar `GRAPH_API_VERSION_DEFAULT` da configuração global.

---

### 8.4 Tabela parametro_auditoria

Audita alterações em parâmetros globais e parâmetros de cliente.

```sql
create table if not exists parametro_auditoria (
  id uuid primary key default gen_random_uuid(),

  escopo text not null check (escopo in ('SISTEMA', 'CLIENTE', 'INTEGRACAO', 'IA', 'APROVACAO')),
  cliente_id uuid references clientes(id),
  usuario_id uuid references usuarios(id),

  chave text not null,
  categoria text,

  valor_anterior_mascarado text,
  valor_novo_mascarado text,

  acao text not null check (acao in ('CRIADO', 'ALTERADO', 'REMOVIDO', 'TESTADO')),

  origem text default 'WEBAPP',
  ip text,
  user_agent text,

  criado_em timestamptz not null default now()
);

create index if not exists idx_parametro_auditoria_cliente_id on parametro_auditoria(cliente_id);
create index if not exists idx_parametro_auditoria_escopo on parametro_auditoria(escopo);
create index if not exists idx_parametro_auditoria_chave on parametro_auditoria(chave);
create index if not exists idx_parametro_auditoria_criado_em on parametro_auditoria(criado_em);
```

---

## 9. Resolver configuração com fallback

Criar uma função central no backend para resolver parâmetros.

Exemplo conceitual:

```ts
async function getConfigValue(clienteId: string | null, chave: string) {
  if (clienteId) {
    const configCliente = await getClienteConfiguracao(clienteId, chave);

    if (configCliente && !configCliente.usar_padrao_sistema) {
      return decryptIfNeeded(configCliente);
    }
  }

  const configSistema = await getSistemaConfiguracao(chave);

  return decryptIfNeeded(configSistema);
}
```

Regra:

1. Se houver configuração específica do cliente e ela não estiver marcada para usar padrão do sistema, usar valor do cliente.
2. Caso contrário, usar configuração global.
3. Se não existir nenhum valor, retornar erro controlado.

---

## 10. Não espalhar leitura de .env pelo código

Hoje o sistema provavelmente lê diretamente variáveis como:

```ts
process.env.GRAPH_API_VERSION
process.env.GOOGLE_DRIVE_FOLDER_ID
process.env.GEMINI_MODEL
```

A partir dessa implementação, o dev deve evitar chamadas diretas espalhadas pelo código.

Criar um serviço central:

```text
src/lib/config/config-service.ts
```

Funções sugeridas:

```ts
getSistemaConfig(chave)
getClienteConfig(clienteId, chave)
getResolvedConfig(clienteId, chave)
getClienteIntegracoes(clienteId)
getClienteAIConfig(clienteId)
```

Apenas configurações realmente estruturais do deploy devem continuar vindo do `.env`.

---

## 11. O que continua no .env

Continuam no `.env` apenas parâmetros necessários para a aplicação subir.

Exemplos:

```env
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_MASTER_KEY
APP_ENV
```

Atenção:

Mesmo que alguns valores fiquem visíveis na tela de sistema, a fonte real pode continuar sendo `.env`, principalmente em produção.

Nesses casos, a tela deve mostrar o valor como somente leitura.

---

## 12. Parâmetros somente leitura

Alguns parâmetros podem aparecer na tela, mas não devem ser editáveis.

Exemplos:

```text
SUPABASE_URL
APP_ENV
STORAGE_MODE
SECRET_STORAGE_MODE
```

A tabela `sistema_configuracoes.editavel` deve controlar isso.

Se `editavel = false`, o frontend exibe o campo bloqueado.

---

## 13. Tratamento de segredos

### 13.1 Regra de exibição

Nunca exibir o valor completo de um segredo.

Exemplo:

```text
Valor real: sk-proj-1234567890abcdef
Exibição: sk-proj-...cdef
```

### 13.2 Regra de edição

Se o campo de segredo vier vazio em uma atualização, manter o valor atual.

Se vier preenchido, substituir o segredo.

Exemplo:

```json
{
  "instagram_access_token": ""
}
```

Resultado:

```text
Manter token atual
```

Exemplo:

```json
{
  "instagram_access_token": "NOVO_TOKEN"
}
```

Resultado:

```text
Criptografar e substituir token
```

---

## 14. Permissões

| Ação | SUPER_ADMIN | ADMIN_CLIENTE | CRIADOR | APROVADOR | VISUALIZADOR |
|---|---|---|---|---|---|
| Ver configurações do sistema | Sim | Não | Não | Não | Não |
| Editar configurações do sistema | Sim | Não | Não | Não | Não |
| Ver configurações do cliente | Sim | Sim | Não | Opcional | Não |
| Editar dados básicos do cliente | Sim | Opcional | Não | Não | Não |
| Editar branding | Sim | Opcional | Não | Não | Não |
| Editar integrações | Sim | Opcional | Não | Não | Não |
| Editar segredos | Sim | Opcional avançado | Não | Não | Não |
| Editar IA do cliente | Sim | Opcional | Não | Não | Não |
| Editar regras de aprovação | Sim | Sim | Não | Não | Não |
| Ver logs de parâmetros | Sim | Opcional | Não | Não | Não |

Recomendação:

Na primeira versão, somente `SUPER_ADMIN` deve editar integrações, segredos e IA.

O `ADMIN_CLIENTE` pode visualizar status e solicitar ajuste.

---

## 15. Modelo comercial suportado

Essa separação permite vender a plataforma de duas formas.

### 15.1 Cliente parametriza sozinho

O cliente recebe acesso ao painel e configura:

```text
Usuários
Aprovadores
Marca
Regras de aprovação
IA
Integrações, se permitido
```

Indicado para clientes mais técnicos.

### 15.2 Implantação feita pelo Christian

Você vende horas de implantação para configurar:

```text
Cadastro inicial do cliente
Google Drive
Meta/Instagram
Tokens
IA
Webhooks n8n
Usuários
Fluxo de aprovação
Treinamento
Publicação assistida inicial
```

Indicado para clientes que querem a ferramenta funcionando sem precisar entender a parte técnica.

### 15.3 Recomendação

Na primeira fase comercial, usar o modelo de implantação assistida.

Motivo:

- Reduz erro de configuração
- Evita cliente mexendo em token e credencial
- Permite cobrar setup inicial
- Garante melhor experiência
- Aumenta controle sobre a operação

---

## 16. Estados de configuração

Cada área de configuração deve ter status.

### Status sugeridos

```text
CONFIGURADO
PENDENTE
ERRO
EXPIRADO
NAO_CONFIGURADO
USANDO_PADRAO_SISTEMA
```

Exemplo visual:

```text
Supabase ativo
Google Drive ativo
Meta/Instagram ativo
Gemini pendente
```

Esses status devem ser calculados com base nas configurações e testes de conexão.

---

## 17. Testes de conexão

Criar endpoints para testar configurações.

### Sistema

```http
POST /api/admin/configuracoes/sistema/testar
```

### Cliente

```http
POST /api/clientes/:clienteId/configuracoes/testar
```

### Integrações

```http
POST /api/clientes/:clienteId/integracoes/google-drive/testar
POST /api/clientes/:clienteId/integracoes/meta/testar
POST /api/clientes/:clienteId/integracoes/n8n/testar
POST /api/clientes/:clienteId/ia/testar
```

Toda execução de teste deve gerar log.

---

## 18. APIs sugeridas

### Configurações do sistema

```http
GET /api/admin/configuracoes/sistema
PATCH /api/admin/configuracoes/sistema
POST /api/admin/configuracoes/sistema/testar
```

### Configurações do cliente

```http
GET /api/clientes/:clienteId/configuracoes
PATCH /api/clientes/:clienteId/configuracoes
```

### Integrações do cliente

```http
GET /api/clientes/:clienteId/integracoes
PATCH /api/clientes/:clienteId/integracoes
POST /api/clientes/:clienteId/integracoes/:tipo/testar
```

### IA do cliente

```http
GET /api/clientes/:clienteId/ia/configuracao
PATCH /api/clientes/:clienteId/ia/configuracao
POST /api/clientes/:clienteId/ia/testar
```

### Regras de aprovação

```http
GET /api/clientes/:clienteId/regras-aprovacao
PATCH /api/clientes/:clienteId/regras-aprovacao
```

### Auditoria de parâmetros

```http
GET /api/admin/logs/parametros
GET /api/clientes/:clienteId/logs/parametros
```

---

## 19. Payload de configuração do cliente

Exemplo:

```json
{
  "dados": {
    "nome": "Desata Assessoria",
    "slug": "desata-assessoria",
    "status": "ATIVO"
  },
  "branding": {
    "logo_url": "https://...",
    "cor_primaria": "#001836",
    "cor_secundaria": "#0060ac"
  },
  "operacao": {
    "modo_operacao": "SIMULADOR",
    "fuso_horario": "America/Sao_Paulo",
    "idioma": "pt-BR"
  },
  "aprovacao": {
    "exige_aprovacao": true,
    "numero_minimo_aprovadores": 1,
    "justificativa_rejeicao_obrigatoria": true
  }
}
```

---

## 20. Payload de integração do cliente

Exemplo:

```json
{
  "google_drive": {
    "google_drive_folder_id": "13SV4_yTC6HG84yf92kZTCY9o4-zMRyOH",
    "google_drive_imagens_folder_id": "...",
    "google_drive_videos_folder_id": "...",
    "google_drive_publicados_folder_id": "..."
  },
  "meta": {
    "instagram_actor_id": "27601143972907315",
    "instagram_user_id": "...",
    "instagram_business_id": "...",
    "facebook_page_id": "...",
    "graph_api_version": "",
    "access_token": ""
  },
  "n8n": {
    "n8n_approval_webhook_url": "...",
    "n8n_publish_webhook_url": "...",
    "n8n_error_webhook_url": "...",
    "webhook_secret": ""
  }
}
```

Regra:

Se `graph_api_version` estiver vazio, usar padrão global.

---

## 21. Payload de auditoria

Exemplo:

```json
{
  "escopo": "CLIENTE",
  "cliente_id": "...",
  "usuario_id": "...",
  "chave": "EXIGE_APROVACAO",
  "categoria": "APROVACAO",
  "valor_anterior_mascarado": "false",
  "valor_novo_mascarado": "true",
  "acao": "ALTERADO",
  "origem": "WEBAPP"
}
```

Para segredos:

```json
{
  "chave": "INSTAGRAM_ACCESS_TOKEN",
  "valor_anterior_mascarado": "EAAB...92F",
  "valor_novo_mascarado": "EAAB...4KT"
}
```

Nunca salvar o valor completo.

---

## 22. Componentes de frontend recomendados

Criar componentes reutilizáveis.

```text
SettingsLayout
SettingsSection
SettingsField
SecretInput
StatusBadge
ConnectionStatusCard
ConfigAuditTable
ConfigSaveBar
ConfigTestButton
```

### SecretInput

Comportamento:

```text
Exibe valor mascarado
Permite inserir novo valor
Não permite copiar valor real
Mostra aviso de segurança
Se vazio, mantém valor atual
```

### ConnectionStatusCard

Exibe:

```text
Nome da integração
Status
Último teste
Mensagem do último erro
Botão testar conexão
Botão editar
```

---

## 23. UX recomendada

Não criar uma tela única gigante.

Separar por abas ou seções:

```text
Dados
Branding
Operação
Integrações
IA
Aprovação
Limites
Auditoria
```

Isso evita que o cliente se perca.

### Exemplo de organização

```text
Configurações do Cliente
  - Dados
  - Branding
  - Operação
  - Aprovação
  - Limites

Integrações
  - Google Drive
  - Meta/Instagram
  - n8n

Inteligência Artificial
  - Provedor
  - Modelo
  - Prompt
  - Limites
  - Testes

Auditoria
  - Alterações
  - Testes de conexão
  - Falhas
```

---

## 24. Regras de validação

### Sistema

```text
APP_URL deve ser URL válida.
GRAPH_API_VERSION_DEFAULT deve seguir padrão vXX.X.
INSTAGRAM_GRAPH_BASE_URL deve ser URL válida.
SECRET_STORAGE_MODE deve aceitar valores controlados.
```

### Cliente

```text
Nome obrigatório.
Slug obrigatório e único.
Status obrigatório.
Cor primária deve ser hexadecimal válida.
Cor secundária deve ser hexadecimal válida.
Fuso horário deve ser válido.
Modo de operação deve ser SIMULADOR ou REAL.
```

### Integrações

```text
Google Drive Folder ID obrigatório para publicação real.
Instagram Actor ID obrigatório para publicação real.
Facebook Page ID recomendado quando usar Meta.
Access Token obrigatório para publicação real.
Webhook n8n deve ser URL válida, se informado.
```

### IA

```text
Provider obrigatório.
Modelo obrigatório.
API key obrigatória se não usar chave global.
Temperatura entre 0 e 2.
Max tokens maior que zero.
```

---

## 25. Impacto no fluxo de publicação

Antes de publicar, o backend deve validar as configurações do cliente.

Checklist mínimo:

```text
Cliente está ativo?
Cliente está em modo REAL?
Google Drive configurado?
Meta/Instagram configurado?
Token válido?
Post pertence ao cliente?
Usuário tem permissão?
Post está aprovado?
Mídia está válida?
```

Se alguma configuração obrigatória estiver ausente, bloquear publicação com erro claro.

Exemplo:

```json
{
  "success": false,
  "error": "CLIENT_CONFIG_INCOMPLETE",
  "message": "Cliente sem configuração de Meta/Instagram para publicação real."
}
```

---

## 26. Impacto no fluxo de IA

Antes de usar IA, o backend deve validar:

```text
Cliente possui configuração de IA?
Se não possui, pode usar padrão global?
API key está configurada?
Modelo está ativo?
Limite de uso foi atingido?
Usuário tem permissão?
```

Se IA estiver pendente, a tela deve mostrar:

```text
IA pendente de configuração
```

Isso explica o badge atual `Gemini pendente`.

---

## 27. Badges de saúde da configuração

Na área superior de configuração, exibir badges como:

```text
Supabase ativo
Google Drive ativo
Meta/Instagram ativo
IA pendente
n8n pendente
Publicação real bloqueada
```

Regra:

Esses badges devem ser calculados com base nas configurações reais.

Exemplo:

```text
Google Drive ativo = pasta configurada + teste de conexão com sucesso
Meta/Instagram ativo = actor id + token válido + teste com sucesso
IA ativa = provider + modelo + chave válida + teste com sucesso
```

---

## 28. Controle de edição por plano

Preparar estrutura para limitar parametrizações por plano.

Exemplo:

```text
Plano Básico: IA padrão da plataforma, sem trocar modelo
Plano Profissional: cliente escolhe modelo
Plano Gerenciado: Christian parametriza tudo
Plano Enterprise: cliente usa chave própria e Azure OpenAI
```

Não precisa implementar cobrança agora, mas o banco deve permitir limitar.

Sugestão futura:

```text
clientes.plano
cliente_configuracoes.editavel_por_cliente
cliente_limites
```

---

## 29. Ordem prática de implementação

Executar nesta ordem:

1. Criar tabela `sistema_configuracoes`
2. Criar tabela `cliente_configuracoes`
3. Criar ou ajustar tabela `cliente_integracoes`
4. Criar tabela `parametro_auditoria`
5. Criar serviço de criptografia e máscara de segredos
6. Criar `config-service.ts`
7. Implementar leitura com fallback sistema -> cliente
8. Criar tela `Configurações do Sistema`
9. Criar tela `Configurações do Cliente`
10. Criar tela `Integrações do Cliente`
11. Integrar tela de IA do cliente
12. Criar logs de auditoria
13. Adicionar badges de saúde da configuração
14. Ajustar fluxo de publicação para validar configuração
15. Ajustar fluxo de IA para validar configuração
16. Criar testes de conexão
17. Testar cliente com configuração completa
18. Testar cliente com configuração pendente
19. Testar cliente usando padrão global
20. Testar bloqueio de publicação sem configuração obrigatória

---

## 30. Critérios de aceite

A implementação será considerada correta quando:

1. Existir separação clara entre configurações do sistema e configurações do cliente.
2. O cliente não visualizar parâmetros técnicos globais sensíveis.
3. O `SUPER_ADMIN` conseguir editar parâmetros globais permitidos.
4. O `SUPER_ADMIN` conseguir parametrizar um cliente completo.
5. O sistema suportar fallback de configuração global para cliente.
6. A publicação usar configurações do cliente ativo.
7. A IA usar configurações do cliente ativo.
8. Segredos forem exibidos apenas mascarados.
9. Alterações de parâmetros forem auditadas.
10. Testes de conexão gerarem logs.
11. Publicação real for bloqueada se configuração obrigatória estiver incompleta.
12. Badges de status refletirem a situação real das integrações.
13. O frontend não tiver uma tela única confusa com todos os campos misturados.
14. O cliente só puder editar aquilo que o perfil e o plano permitirem.
15. O sistema continuar funcionando com as configurações atuais após migração.

---

## 31. Migração da tela atual

A tela atual deve ser quebrada em áreas diferentes.

### Campos que vão para Configurações do Sistema

```text
APP_URL
SUPABASE_URL
GRAPH API VERSION padrão
INSTAGRAM GRAPH BASE URL
ARMAZENAMENTO DE SEGREDOS
```

### Campos que vão para Integrações do Cliente

```text
PASTA RAIZ GOOGLE DRIVE
INSTAGRAM ACTOR ID
FACEBOOK PAGE ID
```

### Campos que vão para IA do Cliente

```text
GEMINI MODEL
Provider de IA
Modelo principal
Modelo fallback
API key
Prompt base
```

---

## 32. Resultado esperado

Ao final, a plataforma terá uma camada profissional de parametrização.

O Christian poderá:

```text
Configurar o sistema globalmente
Cadastrar clientes
Parametrizar cada cliente
Definir se o cliente edita ou não suas configurações
Vender horas de implantação
Auditar alterações
Controlar segredos
Evitar erros de publicação
Padronizar operação
```

O cliente poderá, quando permitido:

```text
Ajustar dados próprios
Gerenciar usuários
Configurar regras de aprovação
Ver status das integrações
Solicitar suporte quando algo estiver pendente
```

A plataforma ficará mais organizada, segura e preparada para operação comercial multi-cliente.

---

## 33. Recomendação final

Não deixar parametrização crítica liberada para todo cliente no primeiro momento.

A primeira versão deve seguir este modelo:

```text
SUPER_ADMIN configura sistema e integrações.
ADMIN_CLIENTE gerencia usuários, aprovação e branding.
CRIADOR cria posts.
APROVADOR aprova posts.
VISUALIZADOR acompanha.
```

Depois, conforme maturidade dos clientes, liberar mais autonomia por plano.

Essa arquitetura permite vender tanto o uso da plataforma quanto serviços de implantação, treinamento e suporte técnico.
