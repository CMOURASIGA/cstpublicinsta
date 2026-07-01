# Orientação Técnica ao Dev - Integração Google Drive via OAuth

## 1. Objetivo

Implementar na plataforma **CST Public Insta** a integração com Google Drive por cliente, usando OAuth da aplicação para permitir que cada cliente conecte sua própria conta Google Drive.

O objetivo é que a plataforma consiga criar ou usar uma estrutura de pastas no Drive do cliente, salvar os IDs internamente e usar esse Drive como biblioteca de mídia da operação.

A publicação para Instagram/Meta não deve depender diretamente do Google Drive. Antes da publicação, a mídia deve ser copiada para um storage operacional da plataforma, inicialmente Supabase Storage, para gerar uma URL controlada pela aplicação.

---

## 2. Ação já realizada no Google Cloud

Foi iniciado o processo de configuração no Google Cloud para o projeto da plataforma.

URL atual da aplicação:

```text
https://cstpublicinsta.vercel.app
```

Redirect URI definido para o fluxo Google Drive OAuth:

```text
https://cstpublicinsta.vercel.app/api/integrations/google-drive/callback
```

O projeto Google Cloud já está na área de OAuth e foi iniciado o processo para criação do cliente OAuth.

O dev deve considerar que esta integração será feita com um **OAuth Client da plataforma**, e não com OAuth Client individual por cliente.

---

## 3. Conceito correto da arquitetura

A plataforma terá um único conjunto global de credenciais OAuth para identificar a aplicação perante o Google.

Essas credenciais globais serão:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_REDIRECT_URI=https://cstpublicinsta.vercel.app/api/integrations/google-drive/callback
```

Cada cliente da plataforma fará sua própria autorização Google Drive.

Portanto:

```text
Client ID e Client Secret = da plataforma CST Public Insta
Autorização Google Drive = individual de cada cliente
Tokens salvos = vinculados ao cliente
Pastas criadas = dentro do Drive da conta autorizada pelo cliente
```

---

## 4. Escopos OAuth recomendados

Para a primeira versão, usar escopos mínimos:

```text
openid
email
profile
https://www.googleapis.com/auth/drive.file
```

### Justificativa

- `openid`, `email` e `profile` identificam a conta Google conectada.
- `drive.file` é mais seguro do que pedir acesso total ao Drive.
- A plataforma deve trabalhar apenas com arquivos e pastas criados ou selecionados pela aplicação.

Evitar inicialmente:

```text
https://www.googleapis.com/auth/drive
```

Esse escopo é amplo demais para a primeira versão e pode gerar resistência do cliente e necessidade maior de revisão pelo Google.

---

## 5. Fluxo funcional desejado

```text
Cliente acessa a plataforma
↓
Vai em Integrações > Google Drive
↓
Clica em Conectar Google Drive
↓
Google exibe tela de consentimento
↓
Cliente autoriza a plataforma
↓
Google redireciona para /api/integrations/google-drive/callback
↓
Backend troca o authorization code por tokens
↓
Backend salva tokens criptografados vinculados ao cliente
↓
Sistema identifica a conta Google conectada
↓
Cliente escolhe criar estrutura automaticamente ou usar pasta existente
↓
Sistema cria ou valida as pastas
↓
Sistema salva os IDs das pastas no banco
↓
Google Drive passa a ser a biblioteca de mídia do cliente
```

---

## 6. Fluxo recomendado para o usuário

Na tela de integração Google Drive, o usuário não deve ser obrigado a informar ID técnico da pasta.

A experiência principal deve ser:

```text
Google Drive
Status: Não conectado

[ Conectar Google Drive ]
```

Depois da conexão:

```text
Conta conectada: cliente@gmail.com

Como deseja configurar?

[ Criar estrutura automaticamente ]
[ Escolher pasta existente ]
[ Configuração avançada ]
```

### Caminho principal

```text
Criar estrutura automaticamente
```

### Caminho secundário

```text
Escolher pasta existente
```

### Caminho avançado

```text
Colar link ou ID da pasta
```

O campo avançado deve aceitar tanto o link completo quanto apenas o ID da pasta.

---

## 7. Estrutura de pastas recomendada

Quando o cliente optar por criar estrutura automaticamente, criar uma pasta raiz no Drive dele.

Nome sugerido da pasta raiz:

```text
CST Public Insta - {Nome do Cliente}
```

Subpastas:

```text
/01 Entrada
/02 Em Aprovação
/03 Aprovados
/04 Publicados
/05 Rejeitados
/06 Arquivados
```

Exemplo final:

```text
CST Public Insta - Desata Assessoria
  /01 Entrada
  /02 Em Aprovação
  /03 Aprovados
  /04 Publicados
  /05 Rejeitados
  /06 Arquivados
```

---

## 8. Papel do Google Drive na plataforma

O Google Drive será usado como **biblioteca e organização de mídia do cliente**.

Ele não deve ser tratado como storage técnico obrigatório para publicação Meta.

Regra recomendada:

```text
Drive do cliente = origem, biblioteca e organização
Storage operacional da plataforma = etapa técnica para publicação
Meta/Instagram = recebe URL controlada pela plataforma
```

Fluxo de publicação:

```text
Mídia está no Drive do cliente
↓
Usuário cria postagem no sistema
↓
Sistema importa/copia mídia para storage operacional
↓
Sistema valida formato, tamanho e resolução
↓
Post segue para aprovação
↓
Ao publicar, Meta acessa a mídia pelo storage operacional
↓
Após publicação, sistema registra histórico e mantém política de retenção
```

---

## 9. Storage operacional

Para a primeira versão, usar:

```text
Supabase Storage
```

Objetivo:

```text
Guardar cópia operacional da mídia para aprovação/publicação.
```

O Supabase Database deve guardar somente os metadados.

Exemplos de metadados:

```text
cliente_id
post_id
media_id
drive_file_id
storage_bucket
storage_path
mime_type
size_bytes
width
height
duration_seconds
status
created_at
```

### Política inicial de retenção

Recomendação:

```text
Manter mídia operacional por 30 dias após publicação.
Depois, manter apenas metadados, miniatura e permalink do Instagram.
```

Essa política pode virar parametrização futura por cliente ou plano.

---

## 10. Tabelas e campos necessários

### 10.1 Ajustar tabela cliente_integracoes

Adicionar campos para Google Drive OAuth e estrutura de pastas.

```sql
alter table cliente_integracoes
add column if not exists google_account_email text,
add column if not exists google_drive_access_token_encrypted text,
add column if not exists google_drive_refresh_token_encrypted text,
add column if not exists google_drive_token_expires_at timestamptz,
add column if not exists google_drive_status text default 'NAO_CONECTADO',
add column if not exists google_drive_last_sync_at timestamptz,
add column if not exists google_drive_last_error text,
add column if not exists google_drive_folder_id text,
add column if not exists google_drive_entrada_folder_id text,
add column if not exists google_drive_aprovacao_folder_id text,
add column if not exists google_drive_aprovados_folder_id text,
add column if not exists google_drive_publicados_folder_id text,
add column if not exists google_drive_rejeitados_folder_id text,
add column if not exists google_drive_arquivados_folder_id text;
```

Status possíveis:

```text
NAO_CONECTADO
CONECTADO
ERRO
EXPIRADO
DESCONECTADO
```

---

### 10.2 Criar tabela cliente_drive_arquivos

Tabela para mapear arquivos do Google Drive usados pela plataforma.

```sql
create table if not exists cliente_drive_arquivos (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid not null references clientes(id) on delete cascade,
  post_id uuid references posts(id) on delete set null,

  drive_file_id text not null,
  drive_folder_id text,
  drive_file_name text,
  drive_mime_type text,
  drive_web_view_link text,

  storage_bucket text,
  storage_path text,
  storage_public_url text,

  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric,

  origem text not null default 'GOOGLE_DRIVE' check (origem in ('GOOGLE_DRIVE', 'UPLOAD_DIRETO', 'LINK_EXTERNO')),
  status text not null default 'IMPORTADO' check (status in ('IMPORTADO', 'EM_APROVACAO', 'APROVADO', 'PUBLICADO', 'REJEITADO', 'ARQUIVADO', 'ERRO')),

  raw_payload jsonb,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_cliente_drive_arquivos_cliente_id on cliente_drive_arquivos(cliente_id);
create index if not exists idx_cliente_drive_arquivos_post_id on cliente_drive_arquivos(post_id);
create index if not exists idx_cliente_drive_arquivos_drive_file_id on cliente_drive_arquivos(drive_file_id);
```

---

### 10.3 Criar tabela google_drive_oauth_states

Tabela para controlar segurança do fluxo OAuth e evitar CSRF.

```sql
create table if not exists google_drive_oauth_states (
  id uuid primary key default gen_random_uuid(),

  state text not null unique,
  cliente_id uuid not null references clientes(id) on delete cascade,
  usuario_id uuid references usuarios(id),

  redirect_after_success text,
  expires_at timestamptz not null,
  used_at timestamptz,

  criado_em timestamptz not null default now()
);

create index if not exists idx_google_drive_oauth_states_state on google_drive_oauth_states(state);
create index if not exists idx_google_drive_oauth_states_cliente_id on google_drive_oauth_states(cliente_id);
```

---

## 11. Variáveis de ambiente globais

Adicionar ao ambiente da Vercel/backend:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_REDIRECT_URI=https://cstpublicinsta.vercel.app/api/integrations/google-drive/callback
GOOGLE_DRIVE_SCOPES=openid email profile https://www.googleapis.com/auth/drive.file
```

Essas configurações são globais da plataforma.

Não devem ser cadastradas por cliente.

---

## 12. Rotas backend necessárias

### 12.1 Iniciar conexão Google Drive

```http
POST /api/clientes/:clienteId/integracoes/google-drive/connect
```

Responsabilidades:

1. Validar usuário autenticado.
2. Validar permissão no cliente.
3. Criar `state` seguro.
4. Salvar `state` na tabela `google_drive_oauth_states`.
5. Montar URL de autorização Google.
6. Retornar URL para o frontend redirecionar.

Payload opcional:

```json
{
  "redirect_after_success": "/app/integracoes"
}
```

Resposta:

```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

---

### 12.2 Callback OAuth

```http
GET /api/integrations/google-drive/callback
```

Responsabilidades:

1. Receber `code` e `state`.
2. Validar `state`.
3. Verificar se `state` não expirou.
4. Trocar authorization code por tokens.
5. Buscar dados básicos da conta Google.
6. Criptografar tokens.
7. Salvar tokens em `cliente_integracoes`.
8. Atualizar status para `CONECTADO`.
9. Marcar `state` como usado.
10. Redirecionar usuário para tela de integração.

---

### 12.3 Criar estrutura automática de pastas

```http
POST /api/clientes/:clienteId/integracoes/google-drive/setup-folders
```

Payload:

```json
{
  "mode": "AUTO_CREATE",
  "root_folder_name": "CST Public Insta - Desata Assessoria"
}
```

Responsabilidades:

1. Validar integração Google Drive conectada.
2. Criar pasta raiz, se não existir.
3. Criar subpastas.
4. Salvar IDs na tabela `cliente_integracoes`.
5. Registrar log.
6. Retornar estrutura criada.

Resposta:

```json
{
  "success": true,
  "folders": {
    "root": {
      "name": "CST Public Insta - Desata Assessoria",
      "id": "..."
    },
    "entrada": {
      "name": "01 Entrada",
      "id": "..."
    },
    "aprovacao": {
      "name": "02 Em Aprovação",
      "id": "..."
    },
    "aprovados": {
      "name": "03 Aprovados",
      "id": "..."
    },
    "publicados": {
      "name": "04 Publicados",
      "id": "..."
    },
    "rejeitados": {
      "name": "05 Rejeitados",
      "id": "..."
    },
    "arquivados": {
      "name": "06 Arquivados",
      "id": "..."
    }
  }
}
```

---

### 12.4 Usar pasta existente

```http
POST /api/clientes/:clienteId/integracoes/google-drive/use-existing-folder
```

Payload:

```json
{
  "folder_input": "https://drive.google.com/drive/folders/1AbCDefG..."
}
```

Responsabilidades:

1. Extrair ID da pasta, se for link completo.
2. Validar se a pasta existe.
3. Validar se a conta conectada tem permissão.
4. Criar subpastas dentro dela, se necessário.
5. Salvar IDs.
6. Registrar log.

---

### 12.5 Testar conexão

```http
POST /api/clientes/:clienteId/integracoes/google-drive/test
```

Responsabilidades:

1. Validar token.
2. Renovar access token se necessário.
3. Consultar dados da pasta raiz.
4. Criar arquivo ou pasta temporária de teste.
5. Remover arquivo ou pasta temporária.
6. Atualizar status da integração.
7. Registrar log.

---

### 12.6 Desconectar Google Drive

```http
POST /api/clientes/:clienteId/integracoes/google-drive/disconnect
```

Responsabilidades:

1. Revogar token, se possível.
2. Limpar tokens criptografados.
3. Manter IDs das pastas como histórico.
4. Atualizar status para `DESCONECTADO`.
5. Bloquear novas operações que dependam do Drive.
6. Registrar log.

---

## 13. Serviços backend recomendados

Criar os seguintes serviços:

```text
src/lib/google-drive/oauth-service.ts
src/lib/google-drive/drive-service.ts
src/lib/google-drive/folder-service.ts
src/lib/google-drive/token-service.ts
src/lib/google-drive/media-import-service.ts
src/lib/storage/operational-storage-service.ts
```

### 13.1 oauth-service.ts

Responsável por:

```text
Criar URL OAuth
Validar state
Trocar code por tokens
Buscar perfil Google
```

### 13.2 token-service.ts

Responsável por:

```text
Criptografar tokens
Descriptografar tokens no backend
Renovar access token
Revogar token
Nunca expor token no frontend
```

### 13.3 folder-service.ts

Responsável por:

```text
Criar pasta raiz
Criar subpastas
Validar pasta existente
Extrair ID de link
Salvar IDs no banco
```

### 13.4 media-import-service.ts

Responsável por:

```text
Ler arquivo do Drive
Baixar temporariamente no backend
Validar tipo, tamanho e dimensões
Enviar cópia para Supabase Storage
Salvar metadados
```

---

## 14. Extração de ID da pasta

O sistema deve aceitar link completo ou ID puro.

Função sugerida:

```ts
export function extractGoogleDriveFolderId(input: string): string {
  const trimmed = input.trim();

  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];

  return trimmed;
}
```

Após extrair, validar na API do Drive se o ID realmente é uma pasta.

---

## 15. Criação de pastas no Google Drive

Para criar pastas, usar `files.create` com o mime type de pasta:

```ts
const folderMetadata = {
  name: folderName,
  mimeType: 'application/vnd.google-apps.folder',
  parents: parentFolderId ? [parentFolderId] : undefined
};

const folder = await drive.files.create({
  requestBody: folderMetadata,
  fields: 'id, name, webViewLink'
});
```

Para criar subpastas, passar o ID da pasta raiz em `parents`.

---

## 16. Segurança

Regras obrigatórias:

1. Nunca expor `GOOGLE_CLIENT_SECRET` no frontend.
2. Nunca expor refresh token no frontend.
3. Criptografar access token e refresh token.
4. Usar `state` no OAuth para evitar CSRF.
5. Validar que o usuário tem permissão no cliente antes de iniciar OAuth.
6. Validar que o `state` pertence ao cliente correto.
7. Validar expiração do `state`.
8. Não permitir reutilizar `state` já usado.
9. Registrar logs de conexão, teste, erro e desconexão.
10. Não pedir escopo amplo `drive` na primeira versão.

---

## 17. Permissões da plataforma

Na primeira versão, somente `SUPER_ADMIN` deve conectar, desconectar e alterar Google Drive.

Tabela sugerida:

| Ação | SUPER_ADMIN | ADMIN_CLIENTE | CRIADOR | APROVADOR | VISUALIZADOR |
|---|---|---|---|---|---|
| Conectar Google Drive | Sim | Não na primeira versão | Não | Não | Não |
| Criar estrutura automática | Sim | Não na primeira versão | Não | Não | Não |
| Usar pasta existente | Sim | Não na primeira versão | Não | Não | Não |
| Testar conexão | Sim | Opcional | Não | Não | Não |
| Desconectar Drive | Sim | Não na primeira versão | Não | Não | Não |
| Usar mídia do Drive | Sim | Sim | Sim | Sim | Visualização |

---

## 18. Tela frontend recomendada

### Antes de conectar

```text
Google Drive
Status: Não conectado

Use o Google Drive do cliente como biblioteca de mídia da operação.

[ Conectar Google Drive ]
```

### Após conectar

```text
Google Drive
Status: Conectado
Conta conectada: cliente@gmail.com

Estrutura de pastas: Pendente

[ Criar estrutura automaticamente ]
[ Escolher pasta existente ]
[ Configuração avançada ]
[Testar conexão]
[Desconectar]
```

### Após estrutura criada

```text
Google Drive
Status: Ativo
Conta conectada: cliente@gmail.com
Pasta raiz: CST Public Insta - Nome do Cliente
Último teste: sucesso

Pastas configuradas:
- 01 Entrada
- 02 Em Aprovação
- 03 Aprovados
- 04 Publicados
- 05 Rejeitados
- 06 Arquivados

[Testar conexão]
[Desconectar]
```

---

## 19. Badges de status

Na tela de parametrizações, exibir status:

```text
Google Drive não conectado
Google Drive conectado
Estrutura pendente
Google Drive ativo
Google Drive com erro
Google Drive desconectado
Token expirado
```

Regra para considerar ativo:

```text
Status conectado
+ tokens válidos ou renováveis
+ pasta raiz configurada
+ teste de conexão com sucesso
```

---

## 20. Impacto na criação de post

Na tela de nova postagem, adicionar opções de origem da mídia:

```text
[ Upload do computador ]
[ Escolher do Google Drive ]
[ Link externo ]
```

Para Google Drive:

1. Listar arquivos da pasta `01 Entrada` ou pasta configurada.
2. Permitir selecionar imagem ou vídeo.
3. Importar para storage operacional.
4. Associar mídia ao post.
5. Seguir fluxo normal de aprovação.

---

## 21. Importação para storage operacional

Toda mídia selecionada do Google Drive deve ser copiada para Supabase Storage antes da publicação.

Fluxo:

```text
Selecionar arquivo no Drive
↓
Backend baixa arquivo usando Drive API
↓
Backend valida tipo e tamanho
↓
Backend envia para Supabase Storage
↓
Backend salva metadados
↓
Post usa URL do storage operacional para aprovação/publicação
```

---

## 22. Validações obrigatórias antes de publicar

Antes de publicar no Instagram, validar:

```text
Cliente está ativo?
Post pertence ao cliente?
Usuário tem permissão?
Meta/Instagram está configurado?
Mídia existe no storage operacional?
URL da mídia está acessível para publicação?
Post está aprovado?
Formato da mídia é aceito?
```

Não publicar diretamente usando link do Google Drive.

---

## 23. Logs e auditoria

Registrar logs para:

```text
Google Drive conectado
Google Drive desconectado
Token renovado
Falha ao renovar token
Estrutura de pastas criada
Pasta existente configurada
Teste de conexão executado
Arquivo importado do Drive
Erro ao importar arquivo
Cópia enviada ao storage operacional
```

Campos mínimos:

```text
cliente_id
usuario_id
servico = google_drive
acao
mensagem
payload mascarado
created_at
```

---

## 24. Tratamento de erros

Erros esperados:

```text
GOOGLE_DRIVE_NOT_CONNECTED
GOOGLE_DRIVE_TOKEN_EXPIRED
GOOGLE_DRIVE_PERMISSION_DENIED
GOOGLE_DRIVE_FOLDER_NOT_FOUND
GOOGLE_DRIVE_INVALID_FOLDER
GOOGLE_DRIVE_FILE_NOT_FOUND
GOOGLE_DRIVE_DOWNLOAD_FAILED
GOOGLE_DRIVE_SETUP_INCOMPLETE
GOOGLE_DRIVE_SCOPE_INSUFFICIENT
```

Exemplo de retorno:

```json
{
  "success": false,
  "error": "GOOGLE_DRIVE_SETUP_INCOMPLETE",
  "message": "Google Drive conectado, mas a estrutura de pastas ainda não foi configurada."
}
```

---

## 25. Ordem prática de desenvolvimento

Executar nesta ordem:

1. Adicionar variáveis Google OAuth no ambiente.
2. Criar/ajustar campos em `cliente_integracoes`.
3. Criar tabela `google_drive_oauth_states`.
4. Criar tabela `cliente_drive_arquivos`.
5. Criar serviço de criptografia para tokens.
6. Criar endpoint para iniciar OAuth.
7. Criar endpoint de callback OAuth.
8. Criar serviço de renovação de token.
9. Criar endpoint para criar estrutura automática.
10. Criar endpoint para usar pasta existente.
11. Criar função para extrair ID de pasta a partir de link.
12. Criar endpoint para testar conexão.
13. Criar endpoint para desconectar Drive.
14. Ajustar tela de Integrações do Cliente.
15. Criar seleção de mídia a partir do Drive.
16. Criar importação para Supabase Storage.
17. Ajustar fluxo de criação de post.
18. Ajustar fluxo de publicação para usar storage operacional.
19. Criar logs e auditoria.
20. Testar com cliente piloto.

---

## 26. Critérios de aceite

A entrega será considerada correta quando:

1. O `SUPER_ADMIN` conseguir iniciar conexão Google Drive para um cliente.
2. O Google redirecionar corretamente para o callback da plataforma.
3. O backend conseguir trocar code por tokens.
4. Os tokens forem salvos criptografados.
5. O sistema conseguir identificar a conta Google conectada.
6. O sistema conseguir criar a pasta raiz automaticamente.
7. O sistema conseguir criar as subpastas operacionais.
8. Os IDs das pastas forem salvos em `cliente_integracoes`.
9. O sistema conseguir testar a conexão.
10. O sistema aceitar link completo ou ID de pasta na opção avançada.
11. O sistema conseguir importar arquivo do Drive para Supabase Storage.
12. O post conseguir usar a mídia importada.
13. A publicação não depender diretamente do link do Google Drive.
14. O cliente não precisar copiar ID de pasta no fluxo principal.
15. Todos os eventos relevantes gerarem logs.
16. Usuários sem permissão não conseguirem conectar ou alterar Drive.

---

## 27. Pendências antes de produção

Antes de liberar para clientes reais, validar:

```text
Tela de consentimento OAuth completa
Domínio autorizado correto
Política de privacidade, se exigida pelo Google
Termos de uso, se exigidos pelo Google
Google Drive API ativada
OAuth Client ID criado
Redirect URI correto
Usuários de teste cadastrados, enquanto app estiver em teste
Escopos revisados
Fluxo testado em ambiente de homologação
```

---

## 28. Referências oficiais

- Google OAuth 2.0 para aplicações Web Server: https://developers.google.com/identity/protocols/oauth2/web-server
- Escopos da Google Drive API: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Criar e popular pastas no Google Drive: https://developers.google.com/workspace/drive/api/guides/folder
- Gerenciar clientes OAuth no Google Cloud: https://support.google.com/cloud/answer/15549257

---

## 29. Decisão técnica recomendada

Para a primeira versão, seguir este modelo:

```text
OAuth Client único da plataforma
Escopo drive.file
Conexão feita pelo SUPER_ADMIN
Criação automática da estrutura de pastas
Google Drive como biblioteca do cliente
Supabase Storage como storage operacional temporário
Retenção operacional de 30 dias após publicação
ID manual de pasta apenas como configuração avançada
```

Essa abordagem reduz suporte, evita expor complexidade para o cliente e mantém a plataforma preparada para operação multi-cliente.
