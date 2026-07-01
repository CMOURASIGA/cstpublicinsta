# Orientação Técnica ao Dev - Integração Instagram/Meta na Consult Flow

## 1. Objetivo

Implementar a integração Instagram/Meta na plataforma Consult Flow, hospedada em produção na Vercel, permitindo que cada cliente conecte sua própria conta profissional do Instagram, publique conteúdos pelo sistema e, posteriormente, colete métricas/insights das publicações.

A validação não será feita localmente. Todo o fluxo deve funcionar no ambiente hospedado:

```text
https://cstpublicinsta.vercel.app
```

A Meta está conduzindo o app pelo fluxo novo da **Instagram API with Instagram Login**, que permite que contas profissionais, Business ou Creator, autorizem o app a gerenciar presença no Instagram. Manter também um fluxo alternativo com Facebook Login + Página + Instagram Business Account, caso o fluxo novo não atenda publicação ou insights em produção.

---

## 2. Contexto atual da configuração Meta

App Meta criado:

```text
Consult Flow
```

Domínio configurado:

```text
cstpublicinsta.vercel.app
```

URL base da plataforma:

```text
https://cstpublicinsta.vercel.app
```

Caso de uso selecionado:

```text
Gerenciar mensagens e conteúdo no Instagram
```

Conta Instagram de teste adicionada no painel da Meta:

```text
Username: farmbyfernandacarlota
Instagram User ID: 17841440713580357
```

Na tela do setup da Meta, ficou disponível a opção:

```text
Gerar token
```

Esse token pode ser usado para validação inicial, mas não deve ser o modelo definitivo da plataforma.

---

## 3. Modelo correto para plataforma multi-cliente

A Consult Flow será uma plataforma multi-cliente.

Portanto, os dados globais do app Meta/Instagram ficam em variáveis de ambiente ou configuração global do sistema.

Os tokens e IDs das contas Instagram ficam por cliente, no banco de dados.

### 3.1 Dados globais da plataforma

```env
APP_URL=https://cstpublicinsta.vercel.app

META_APP_ID=1025133856563196
META_APP_SECRET=ENVIAR_POR_CANAL_SEGURO
META_GRAPH_API_VERSION=v25.0
META_REDIRECT_URI=https://cstpublicinsta.vercel.app/api/integrations/meta/callback

INSTAGRAM_APP_ID=27360338356909448
INSTAGRAM_APP_SECRET=ENVIAR_POR_CANAL_SEGURO
INSTAGRAM_REDIRECT_URI=https://cstpublicinsta.vercel.app/api/integrations/instagram/callback

INSTAGRAM_WEBHOOK_VERIFY_TOKEN=GERAR_TOKEN_INTERNO_SEGURO
ENCRYPTION_MASTER_KEY=CHAVE_INTERNA_PARA_CRIPTOGRAFAR_TOKENS
```

### 3.2 Dados por cliente

```text
cliente_id
instagram_username
instagram_user_id
instagram_access_token_encrypted
instagram_token_status
instagram_token_expires_at
instagram_connected_at
instagram_last_sync_at
instagram_connection_mode
```

---

## 4. Não usar token de aplicativo para publicação

O token de aplicativo não serve para publicar no Instagram do cliente.

O token correto precisa vir da autorização da conta Instagram profissional do cliente.

Na versão final, o cliente deve clicar em:

```text
Conectar Instagram
```

E o sistema deve obter o token automaticamente via OAuth.

---

## 5. Fluxos possíveis

## 5.1 Fluxo prioritário: Instagram Login

Este é o fluxo novo apresentado no painel atual da Meta.

Usa:

```text
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
Permissões instagram_business_*
```

Permissões obrigatórias exibidas pela Meta:

```text
instagram_business_basic
instagram_business_manage_comments
instagram_business_manage_messages
```

Permissões necessárias para a Consult Flow:

```text
instagram_business_basic
instagram_business_content_publish
instagram_business_manage_insights
```

Comentários e mensagens podem ficar habilitados pelo caso de uso, mas a primeira entrega deve focar em:

```text
publicação
media_id
insights
logs
segurança de token
```

### Fluxo esperado

```text
Cliente acessa Consult Flow
↓
Vai em Integrações > Instagram
↓
Clica em Conectar Instagram
↓
Sistema redireciona para login/autorização do Instagram
↓
Cliente autoriza a conta profissional
↓
Meta retorna code para o callback
↓
Backend troca code por access_token
↓
Backend busca dados da conta Instagram
↓
Sistema salva token criptografado por cliente
↓
Sistema marca integração como ativa
```

---

## 5.2 Fluxo alternativo: Facebook Login + Página + Instagram Business Account

Este fluxo só deve ser usado se o Instagram Login não liberar corretamente publicação ou insights.

Permissões clássicas:

```text
pages_show_list
pages_read_engagement
instagram_basic
instagram_content_publish
instagram_manage_insights
```

Fluxo:

```text
Cliente conecta via Facebook Login
↓
Backend recebe code
↓
Backend troca code por access_token
↓
Backend chama /me/accounts
↓
Sistema lista páginas disponíveis
↓
Sistema chama /{page_id}?fields=instagram_business_account
↓
Sistema encontra o Instagram Business Account ID
↓
Sistema salva page_id, instagram_business_account_id e token por cliente
```

---

## 6. Rotas backend obrigatórias

Como a validação será feita no ambiente hospedado, todas as rotas abaixo precisam existir na Vercel.

### 6.1 Instagram Login

```http
GET /api/integrations/instagram/connect
GET /api/integrations/instagram/callback
POST /api/integrations/instagram/disconnect
POST /api/integrations/instagram/test
```

### 6.2 Meta/Facebook fallback

```http
GET /api/integrations/meta/connect
GET /api/integrations/meta/callback
POST /api/integrations/meta/disconnect
POST /api/integrations/meta/test
```

### 6.3 Publicação

```http
POST /api/clientes/:clienteId/posts/:postId/publicar-instagram
```

### 6.4 Insights

```http
POST /api/clientes/:clienteId/posts/:postId/insights/sync
GET /api/clientes/:clienteId/posts/:postId/insights
GET /api/clientes/:clienteId/insights/dashboard
```

### 6.5 Webhook futuro

```http
GET /api/integrations/instagram/webhook
POST /api/integrations/instagram/webhook
```

### 6.6 Compliance Meta

```http
POST /api/integrations/meta/deauthorize
POST /api/integrations/meta/data-deletion
```

---

## 7. Redirect URIs previstas

### Meta/Facebook Login

```text
https://cstpublicinsta.vercel.app/api/integrations/meta/callback
```

### Instagram Login

```text
https://cstpublicinsta.vercel.app/api/integrations/instagram/callback
```

Se a Meta pedir callback específico no setup do Instagram Login, usar:

```text
https://cstpublicinsta.vercel.app/api/integrations/instagram/callback
```

---

## 8. Banco de dados

A tabela de integrações do cliente deve suportar Instagram.

### Ajuste sugerido em `cliente_integracoes`

```sql
alter table cliente_integracoes
add column if not exists instagram_username text,
add column if not exists instagram_user_id text,
add column if not exists instagram_access_token_encrypted text,
add column if not exists instagram_token_status text default 'NAO_CONFIGURADO',
add column if not exists instagram_token_expires_at timestamptz,
add column if not exists instagram_connected_at timestamptz,
add column if not exists instagram_last_sync_at timestamptz,
add column if not exists instagram_connection_mode text default 'INSTAGRAM_LOGIN',
add column if not exists instagram_webhook_enabled boolean default false;
```

Valores possíveis para `instagram_token_status`:

```text
NAO_CONFIGURADO
ATIVO
ATIVO_TESTE
EXPIRADO
ERRO
DESCONECTADO
```

Valores possíveis para `instagram_connection_mode`:

```text
INSTAGRAM_LOGIN
FACEBOOK_LOGIN
MANUAL_TEST_TOKEN
```

---

## 9. Logs de integração

Criar ou reutilizar uma tabela de logs.

```sql
create table if not exists integracao_logs (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid references clientes(id),
  usuario_id uuid references usuarios(id),

  provider text not null,
  acao text not null,
  status text not null,

  mensagem text,
  payload jsonb,

  criado_em timestamptz not null default now()
);
```

Ações sugeridas:

```text
INSTAGRAM_CONNECT_STARTED
INSTAGRAM_CALLBACK_RECEIVED
INSTAGRAM_TOKEN_EXCHANGED
INSTAGRAM_ACCOUNT_FETCHED
INSTAGRAM_CONNECTION_SAVED
INSTAGRAM_CONNECTION_TESTED
INSTAGRAM_PUBLISH_STARTED
INSTAGRAM_PUBLISH_CONTAINER_CREATED
INSTAGRAM_PUBLISH_COMPLETED
INSTAGRAM_INSIGHTS_SYNCED
INSTAGRAM_ERROR
INSTAGRAM_DISCONNECTED
```

---

## 10. Criptografia de tokens

Todo token Instagram deve ser salvo criptografado.

Nunca salvar token em texto puro.

Nunca retornar token completo para o frontend.

No frontend, exibir apenas:

```text
Conectado
Usuário: @farmbyfernandacarlota
ID: 17841440713580357
Status: Ativo
Última conexão: data/hora
```

Exibição segura:

```text
Token: IG...****
```

---

## 11. Tela de Integração Instagram

Criar ou ajustar a tela:

```text
Integrações > Instagram
```

### Estado não conectado

```text
Instagram não conectado
[Conectar Instagram]
```

### Estado conectado

```text
Instagram conectado
Conta: @farmbyfernandacarlota
ID: 17841440713580357
Modo: Instagram Login
Status: Ativo
Último teste: sucesso

[Testar conexão]
[Desconectar]
```

### Estado de token manual/teste

```text
Integração usando token manual de teste. Para produção, conecte a conta pelo fluxo oficial de login.
```

---

## 12. Botão Conectar Instagram

A rota:

```http
GET /api/integrations/instagram/connect?clienteId=...
```

Deve:

1. Validar usuário logado.
2. Validar acesso ao cliente.
3. Criar um `state` seguro.
4. Salvar `state` temporário com `clienteId` e `usuarioId`.
5. Redirecionar para o endpoint OAuth do Instagram/Meta.

O `state` precisa evitar CSRF e garantir que o callback pertence ao cliente correto.

---

## 13. Callback Instagram

A rota:

```http
GET /api/integrations/instagram/callback
```

Deve receber:

```text
code
state
error
error_reason
error_description
```

Se houver erro:

1. Registrar log.
2. Redirecionar para tela de integração com mensagem de erro.

Se houver `code`:

1. Validar `state`.
2. Trocar `code` por `access_token`.
3. Buscar dados da conta Instagram autorizada.
4. Salvar dados por cliente.
5. Registrar log.
6. Redirecionar para tela de integração com sucesso.

---

## 14. Modo manual de teste

Como já foi adicionada a conta `farmbyfernandacarlota` no painel da Meta, o token gerado manualmente pode ser usado em um modo provisório.

Criar opção administrativa:

```text
Cadastrar token Instagram manualmente
```

Apenas `SUPER_ADMIN` pode usar.

Campos:

```text
cliente_id
instagram_username
instagram_user_id
instagram_access_token
status
```

Para a conta de teste atual:

```text
instagram_username=farmbyfernandacarlota
instagram_user_id=17841440713580357
status=ATIVO_TESTE
```

Esse modo serve para validar publicação antes do OAuth final estar pronto.

---

## 15. Publicação no Instagram

O sistema deve usar o token do cliente.

Fluxo:

```text
Post aprovado
↓
Usuário clica em publicar
↓
Backend valida cliente, permissão e integração
↓
Backend valida mídia
↓
Backend cria URL pública/assinada da mídia no storage operacional
↓
Backend cria container de mídia na API do Instagram
↓
Backend publica container
↓
Backend salva instagram_media_id no post
↓
Backend registra histórico e logs
```

### Campos necessários em `posts`

```sql
alter table posts
add column if not exists instagram_media_id text,
add column if not exists instagram_permalink text,
add column if not exists instagram_published_at timestamptz,
add column if not exists instagram_publish_status text,
add column if not exists instagram_publish_error text;
```

Status sugeridos:

```text
NAO_PUBLICADO
PUBLICANDO
PUBLICADO
ERRO_PUBLICACAO
```

---

## 16. Storage operacional

A Meta precisa acessar a mídia por uma URL válida.

O sistema não deve publicar diretamente a partir do Google Drive.

Fluxo recomendado:

```text
Drive do cliente ou upload local
↓
Storage operacional da plataforma
↓
URL pública/assinada temporária
↓
Instagram API
```

Na primeira versão, usar Supabase Storage como storage operacional.

A mídia operacional pode ter retenção de 30 dias após publicação.

---

## 17. Insights pós-publicação

Depois de publicar e salvar `instagram_media_id`, o sistema deve buscar insights.

Criar tabela:

```sql
create table if not exists post_insights_resumo (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid not null references clientes(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,

  instagram_media_id text not null,

  views numeric default 0,
  reach numeric default 0,
  likes numeric default 0,
  comments numeric default 0,
  shares numeric default 0,
  saved numeric default 0,
  total_interactions numeric default 0,
  engagement_rate numeric default 0,

  last_sync_at timestamptz,
  raw_payload jsonb,

  unique (post_id)
);
```

Criar serviço:

```text
syncInstagramPostInsights(clienteId, postId)
```

Rotina sugerida:

```text
15 minutos após publicar
1 hora após publicar
6 horas após publicar
24 horas após publicar
7 dias após publicar
28 dias após publicar
```

---

## 18. Webhooks

A tela da Meta pede:

```text
URL de callback
Verificar token
```

Para agora, webhooks não são obrigatórios para publicação e insights por polling.

Deixar documentado para fase posterior:

```text
Callback URL:
https://cstpublicinsta.vercel.app/api/integrations/instagram/webhook

Verify Token:
INSTAGRAM_WEBHOOK_VERIFY_TOKEN
```

Implementar depois para:

```text
comentários
mensagens
menções
eventos da conta
```

---

## 19. Endpoints de compliance Meta

Implementar em fase junto com preparação para App Review.

### Desautorização

```http
POST /api/integrations/meta/deauthorize
```

Responsabilidades:

```text
Receber aviso de desautorização
Identificar integração
Marcar como DESCONECTADO
Invalidar tokens
Registrar log
```

### Exclusão de dados

```http
POST /api/integrations/meta/data-deletion
```

Responsabilidades:

```text
Receber solicitação da Meta
Gerar confirmation_code
Registrar solicitação
Responder no padrão esperado pela Meta
Permitir acompanhamento da exclusão
```

---

## 20. Validação no ambiente hospedado

Validar tudo em:

```text
https://cstpublicinsta.vercel.app
```

Checklist técnico:

1. Variáveis de ambiente configuradas na Vercel.
2. Deploy realizado.
3. `/api/integrations/instagram/callback` acessível.
4. `/api/integrations/meta/callback` acessível.
5. Tela de integração disponível.
6. Botão Conectar Instagram funcionando.
7. Callback redirecionando corretamente.
8. Token salvo criptografado.
9. Teste de conexão funcionando.
10. Publicação de imagem funcionando.
11. `instagram_media_id` salvo.
12. Insights sincronizados.

---

## 21. Critérios de aceite da primeira entrega

A primeira entrega será aceita quando:

1. O cliente possuir tela de integração Instagram.
2. O `SUPER_ADMIN` conseguir cadastrar token manual de teste.
3. A conta `farmbyfernandacarlota` puder ser cadastrada com:
   - username
   - instagram_user_id
   - access_token criptografado
4. O sistema conseguir testar a conexão.
5. O sistema conseguir publicar uma imagem simples.
6. O sistema salvar o `instagram_media_id`.
7. O sistema registrar logs da publicação.
8. O sistema não expuser token no frontend.
9. A publicação ocorrer usando configuração do cliente, não variável global fixa.
10. O fluxo funcionar em produção na Vercel.

---

## 22. Critérios de aceite da segunda entrega

A segunda entrega será aceita quando:

1. OAuth Instagram Login funcionar pela tela da plataforma.
2. O cliente conseguir clicar em Conectar Instagram.
3. A Meta retornar `code` para o callback.
4. O backend trocar `code` por token.
5. O backend salvar token e Instagram User ID por cliente.
6. O sistema não depender mais de token manual.
7. O sistema conseguir desconectar integração.
8. O sistema conseguir renovar ou alertar expiração de token.
9. Insights pós-publicação estiverem funcionando.
10. Sistema estiver preparado para App Review.

---

## 23. Ordem prática de desenvolvimento

Executar nesta ordem:

1. Configurar variáveis de ambiente na Vercel.
2. Criar campos Instagram em `cliente_integracoes`.
3. Criar logs de integração.
4. Criar tela de Integrações > Instagram.
5. Criar modo manual de token de teste para `SUPER_ADMIN`.
6. Salvar token criptografado.
7. Criar teste de conexão.
8. Publicar uma imagem simples usando token de teste.
9. Salvar `instagram_media_id` no post.
10. Criar sincronização básica de insights.
11. Criar rota `/api/integrations/instagram/connect`.
12. Criar rota `/api/integrations/instagram/callback`.
13. Implementar OAuth Instagram Login.
14. Trocar `code` por token.
15. Salvar integração automaticamente por cliente.
16. Criar desconexão.
17. Implementar endpoints de desautorização e exclusão de dados.
18. Preparar documentação para App Review.

---

## 24. Observação final

O token gerado manualmente no painel da Meta é útil para validação inicial, mas não deve ser o modelo definitivo.

A plataforma final precisa funcionar assim:

```text
Cliente conecta Instagram pelo botão da Consult Flow
↓
Sistema recebe autorização
↓
Sistema salva token criptografado por cliente
↓
Sistema publica usando a integração daquele cliente
↓
Sistema coleta insights da publicação
```

Isso garante que a Consult Flow funcione como plataforma multi-cliente, sem depender de variáveis globais fixas de Instagram.
