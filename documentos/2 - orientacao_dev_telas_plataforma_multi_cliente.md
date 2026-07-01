# Orientação Técnica ao Dev - Implantação dos Modelos de Tela na Plataforma Multi-Cliente

## 1. Objetivo deste documento

Este documento orienta a implementação dos modelos de tela enviados nos arquivos ZIP `stitch_portal_de_gest_o_integrada`.

Os modelos analisados representam uma proposta visual e funcional para transformar o sistema atual de aprovação de publicações em uma plataforma única multi-cliente, com gestão centralizada de clientes, usuários, integrações, publicações, logs e visão executiva.

A implementação deve respeitar a estrutura multi-cliente já definida anteriormente, usando `cliente_id` como base de separação operacional em todas as telas e APIs.

---

## 2. Telas identificadas nos modelos enviados

Foram identificados os seguintes modelos principais:

1. Dashboard global do administrador
2. Cadastro de novo cliente
3. Gestão de usuários do cliente
4. Integrações do cliente
5. Criação de nova postagem com prévia mobile
6. Base visual e design system

Também foram enviados arquivos de design sem tela renderizada válida em alguns ZIPs. Esses arquivos reforçam a identidade visual, paleta, tipografia, espaçamento e regras de layout.

---

## 3. Direção geral da interface

A interface proposta segue uma lógica de portal administrativo.

A navegação principal deve ser feita por menu lateral fixo, com uma barra superior para busca, notificações, ajuda, configurações e seletor de cliente ativo.

A plataforma terá dois contextos principais:

### 3.1 Contexto Super Admin

Usado pelo Christian ou por administradores globais.

Permite:

- Ver todos os clientes
- Cadastrar clientes
- Alternar cliente ativo
- Ver dashboard global
- Gerenciar usuários
- Gerenciar integrações
- Ver logs
- Acompanhar saúde da operação

### 3.2 Contexto Cliente

Usado por administradores, criadores, aprovadores e visualizadores de um cliente específico.

Permite:

- Ver somente dados do cliente permitido
- Criar postagens
- Aprovar ou rejeitar postagens
- Ver histórico
- Ver configurações permitidas
- Acompanhar publicações

---

## 4. Estrutura de navegação recomendada

O menu lateral deve conter:

```text
Dashboard
Clientes
Postagens
Usuários
Integrações
Logs
Help Center
Sair
```

### Regras de exibição por perfil

| Menu | SUPER_ADMIN | ADMIN_CLIENTE | CRIADOR | APROVADOR | VISUALIZADOR |
|---|---|---|---|---|---|
| Dashboard | Sim | Sim | Sim | Sim | Sim |
| Clientes | Sim | Não | Não | Não | Não |
| Postagens | Sim | Sim | Sim | Sim | Sim |
| Usuários | Sim | Sim | Não | Não | Não |
| Integrações | Sim | Opcional | Não | Não | Não |
| Logs | Sim | Opcional | Não | Não | Não |
| Help Center | Sim | Sim | Sim | Sim | Sim |
| Sair | Sim | Sim | Sim | Sim | Sim |

---

## 5. Design system identificado

### 5.1 Nome conceitual

O modelo usa o conceito visual `ConsultFlow Hub`.

Para o sistema real, o dev deve tratar esse nome como referência visual, não como nome definitivo obrigatório.

Caso a plataforma tenha outro nome comercial, substituir em todos os textos.

---

### 5.2 Paleta de cores base

Usar a paleta abaixo como base do sistema:

```css
--primary: #001836;
--primary-container: #002d5b;
--secondary: #0060ac;
--secondary-container: #68abff;

--background: #f8f9ff;
--surface: #f8f9ff;
--surface-container-lowest: #ffffff;
--surface-container-low: #eff4ff;
--surface-container: #e5eeff;
--surface-border: #e2e8f0;

--on-surface: #0b1c30;
--on-surface-variant: #43474f;

--status-draft: #94a3b8;
--status-pending: #f59e0b;
--status-approved: #10b981;
--status-rejected: #ef4444;
--status-error: #e11d48;
```

### 5.3 Regra de cores por cliente

As cores `primary` e `secondary` poderão ser substituídas pelas cores cadastradas na tabela `clientes`.

Campos previstos:

```text
clientes.cor_primaria
clientes.cor_secundaria
```

As cores semânticas de status não devem mudar por cliente.

Motivo: status operacional precisa ser reconhecido do mesmo jeito em toda a plataforma.

---

### 5.4 Tipografia

O modelo usa:

```text
Hanken Grotesk - títulos
Inter - textos gerais
JetBrains Mono - metadados, IDs e labels técnicas
```

Implementar:

```css
font-family-title: "Hanken Grotesk", sans-serif;
font-family-body: "Inter", sans-serif;
font-family-mono: "JetBrains Mono", monospace;
```

Caso o projeto atual já use outra fonte, o dev pode manter a estrutura atual, mas a recomendação visual é migrar para essas fontes.

---

### 5.5 Espaçamento e layout

Regras identificadas:

```text
Grid principal: 12 colunas
Gutter: 24px
Margem desktop: 32px
Margem mobile: 16px
Sidebar Super Admin: 280px
Sidebar usuário padrão: 240px
Header global: 72px
Container máximo: 1440px
Base de espaçamento: 4px
```

---

## 6. Componentes base que devem ser criados

Criar componentes reutilizáveis para evitar duplicidade de código.

### 6.1 Layout principal

Componente sugerido:

```tsx
<AppShell>
  <Sidebar />
  <MainArea>
    <Topbar />
    <PageContent />
  </MainArea>
</AppShell>
```

Responsabilidades:

- Renderizar menu lateral
- Renderizar header global
- Controlar cliente ativo
- Controlar permissões
- Aplicar tema global
- Aplicar cores do cliente ativo, quando existir

---

### 6.2 Sidebar

Componente:

```tsx
<Sidebar />
```

Deve conter:

- Nome ou logo da plataforma
- Identificação do usuário
- Perfil do usuário
- Menu principal
- Help Center
- Logout

Exemplo de identificação:

```text
Christian
Super Admin
Global Controller
```

Para usuário cliente:

```text
Maria Silva
Aprovador
Cliente: Desata Assessoria
```

---

### 6.3 Topbar

Componente:

```tsx
<Topbar />
```

Deve conter:

- Busca global
- Seletor de cliente ativo
- Notificações
- Ajuda
- Configurações
- Avatar do usuário

Para `SUPER_ADMIN`, o seletor de cliente deve permitir alternar clientes.

Para usuários de um único cliente, pode mostrar apenas o nome do cliente sem dropdown.

---

### 6.4 ClientSelector

Componente:

```tsx
<ClientSelector />
```

Regras:

- Buscar clientes disponíveis para o usuário logado
- Persistir cliente ativo
- Alterar contexto global da aplicação
- Recarregar dados ao trocar cliente
- Bloquear seleção de cliente sem permissão

Estado sugerido:

```ts
type ActiveClient = {
  id: string;
  nome: string;
  slug: string;
  logo_url?: string;
  cor_primaria?: string;
  cor_secundaria?: string;
};
```

---

### 6.5 Cards de indicadores

Componente:

```tsx
<MetricCard />
```

Props sugeridas:

```ts
type MetricCardProps = {
  title: string;
  value: string | number;
  variation?: string;
  icon?: string;
  status?: "neutral" | "success" | "warning" | "error";
};
```

Usar no dashboard, tela de usuários, tela de integrações e relatórios.

---

### 6.6 Tabelas administrativas

Componente:

```tsx
<DataTable />
```

Recursos obrigatórios:

- Busca
- Filtros
- Paginação
- Ações por linha
- Estado vazio
- Estado carregando
- Estado erro
- Primeira coluna sticky no mobile, quando necessário

---

### 6.7 Badges de status

Componente:

```tsx
<StatusBadge />
```

Status de cliente:

```text
ATIVO
INATIVO
SUSPENSO
```

Status de post:

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

Status de integração:

```text
CONECTADO
PENDENTE
ERRO
EXPIRADO
NAO_CONFIGURADO
```

Status de usuário:

```text
ATIVO
INATIVO
AUSENTE
PENDENTE_CONVITE
```

---

## 7. Tela 1 - Dashboard global

### 7.1 Objetivo

Exibir uma visão executiva da operação da plataforma para o `SUPER_ADMIN`.

Essa tela deve ser a entrada principal do Christian.

### 7.2 Elementos identificados no modelo

A tela possui:

- Título `Visão Global`
- Saudação executiva
- Busca de clientes ou logs
- Cards de indicadores
- Lista de atividade recente dos clientes
- Card de volume semanal
- Menu lateral com escopo Super Admin

### 7.3 Indicadores sugeridos

Exibir no mínimo:

```text
Clientes ativos
Posts pendentes de aprovação
Publicações do mês
Taxa de sucesso
Erros nas últimas 24h
Integrações com problema
```

### 7.4 Dados necessários

Endpoint sugerido:

```http
GET /api/admin/dashboard
```

Resposta sugerida:

```json
{
  "clientes_ativos": 124,
  "posts_pendentes": 42,
  "publicacoes_mes": 1800,
  "taxa_sucesso": 99.4,
  "erros_24h": 0,
  "integracoes_com_problema": 3,
  "atividade_recente": [
    {
      "cliente_id": "...",
      "cliente_nome": "StarTech AI",
      "conteudo": "Lançamento do módulo GPT",
      "status": "PENDENTE_APROVACAO",
      "data": "2026-06-30T10:24:00Z"
    }
  ]
}
```

### 7.5 Regras de permissão

A tela global só deve ser acessível por:

```text
SUPER_ADMIN
```

Usuários de cliente devem ser redirecionados para o dashboard do próprio cliente.

---

## 8. Tela 2 - Cadastro de novo cliente

### 8.1 Objetivo

Permitir que o `SUPER_ADMIN` cadastre um novo cliente na plataforma.

### 8.2 Elementos identificados no modelo

A tela possui:

- Breadcrumb `Clientes / Novo Cliente`
- Título `Cadastro de Novo Cliente`
- Botões `Cancelar` e `Salvar Cliente`
- Bloco `Identidade Corporativa`
- Bloco `Ecossistema de Integração`
- Bloco `Visual & Branding`
- Prévia visual da interface
- Aviso informativo após salvar

### 8.3 Campos do formulário

#### Identidade Corporativa

```text
Nome do Cliente
Slug do Sistema
Status Inicial
```

Status:

```text
ATIVO
INATIVO
SUSPENSO
```

#### Ecossistema de Integração

```text
Google Drive Root Folder ID
Instagram Business ID
```

Campos adicionais recomendados:

```text
Facebook Page ID
Instagram User ID
Graph API Version
Webhook n8n
Modo de operação
```

#### Visual & Branding

```text
Logotipo do Cliente
Cor Primária
Cor Secundária
```

### 8.4 Endpoint sugerido

```http
POST /api/admin/clientes
```

Payload:

```json
{
  "nome": "Acme Corporation",
  "slug": "acme-corp",
  "status": "ATIVO",
  "logo_url": "...",
  "cor_primaria": "#002d5b",
  "cor_secundaria": "#0060ac",
  "integracoes": {
    "google_drive_folder_id": "...",
    "instagram_business_id": "...",
    "facebook_page_id": "...",
    "instagram_user_id": "...",
    "graph_api_version": "v23.0",
    "n8n_approval_webhook_url": "...",
    "modo_operacao": "SIMULADOR"
  }
}
```

### 8.5 Comportamento esperado

Ao salvar:

1. Criar registro em `clientes`
2. Criar registro em `cliente_integracoes`
3. Criar pastas auxiliares, se aplicável
4. Registrar log da ação
5. Redirecionar para tela de detalhes do cliente ou lista de clientes

### 8.6 Validações

- Nome obrigatório
- Slug obrigatório
- Slug único
- Status obrigatório
- Cor primária precisa ser hexadecimal válido, se informada
- Cor secundária precisa ser hexadecimal válido, se informada
- Logo deve aceitar PNG, JPG ou SVG
- Limite sugerido da logo: 5MB

---

## 9. Tela 3 - Gestão de usuários do cliente

### 9.1 Objetivo

Permitir gerenciar os usuários vinculados a um cliente.

### 9.2 Elementos identificados no modelo

A tela possui:

- Cliente ativo no topo
- Título `Client Users`
- Botão `Invite User`
- Cards de indicadores
- Distribuição de perfis
- Campo de busca
- Filtros
- Tabela de usuários
- Ações por usuário
- Paginação
- Log de auditoria de acessos

### 9.3 Indicadores sugeridos

```text
Total de usuários
Usuários ativos agora
Distribuição por perfil
Convites pendentes
Usuários inativos
```

### 9.4 Tabela de usuários

Colunas sugeridas:

```text
Identidade
E-mail
Perfil
Status
Última atividade
Ações
```

Ações:

```text
Editar perfil
Inativar acesso
Reenviar convite
Remover vínculo
Ver auditoria
```

### 9.5 Endpoint para listar

```http
GET /api/clientes/:clienteId/usuarios
```

Resposta:

```json
{
  "items": [
    {
      "usuario_id": "...",
      "nome": "Julian Sterling",
      "email": "j.sterling@globaltech.com",
      "perfil": "ADMIN_CLIENTE",
      "status": "ATIVO",
      "ultima_atividade": "2026-06-30T14:30:00Z"
    }
  ],
  "total": 24
}
```

### 9.6 Endpoint para convidar

```http
POST /api/clientes/:clienteId/usuarios/convites
```

Payload:

```json
{
  "nome": "Maria Silva",
  "email": "maria@email.com",
  "perfil": "APROVADOR"
}
```

### 9.7 Regras de permissão

Podem acessar:

```text
SUPER_ADMIN
ADMIN_CLIENTE
```

Regras:

- `ADMIN_CLIENTE` só pode gerenciar usuários do próprio cliente
- `ADMIN_CLIENTE` não pode criar `SUPER_ADMIN`
- `SUPER_ADMIN` pode criar qualquer perfil
- Ações devem ser registradas em log e auditoria

---

## 10. Tela 4 - Integrações do cliente

### 10.1 Objetivo

Permitir configurar e monitorar as integrações externas de cada cliente.

### 10.2 Elementos identificados no modelo

A tela possui:

- Título `Client Integrations`
- Descrição da tela
- Status de modo operacional
- Card Google Drive
- Card n8n Webhooks
- Card Meta / Instagram Business
- Card de integridade da conexão
- Card de performance das integrações
- Botão `New Integration`

### 10.3 Integrações mínimas

#### Google Drive

Campos:

```text
Root Folder ID
Images Source
Videos Source
Published Archive
Status da conexão
Última sincronização
```

Ações:

```text
Editar
Re-sincronizar workspace
Testar conexão
```

#### n8n Webhooks

Campos:

```text
Trigger Endpoint
Last ping
Status
```

Ações:

```text
Copiar endpoint
Testar webhook
Editar
```

#### Meta / Instagram Business

Campos:

```text
Access Token
Instagram Business ID
Instagram User ID
Facebook Page ID
Expiração do token
Última chamada API
Status HTTP da última chamada
```

Ações:

```text
Revelar token, se permitido
Atualizar token
Testar conexão
Editar
```

### 10.4 Endpoint para consultar integrações

```http
GET /api/clientes/:clienteId/integracoes
```

Resposta:

```json
{
  "google_drive": {
    "status": "CONECTADO",
    "root_folder_id": "CF_GSG_PRODUCTION_2024",
    "images_source": "/Assets/Unprocessed/Images",
    "videos_source": "/Assets/Unprocessed/Videos",
    "published_archive": "/Archive/Published_Logs",
    "last_sync": "2026-06-30T10:00:00Z"
  },
  "n8n": {
    "status": "PENDENTE",
    "webhook_url_masked": "https://n8n.../webhook-test/...",
    "last_ping": null
  },
  "meta": {
    "status": "CONECTADO",
    "access_token_masked": "...F829L",
    "expires_in_days": 58,
    "facebook_page_id": "109228394475512",
    "instagram_handle": "@strategy_global_official",
    "last_api_call": "2026-06-30T17:00:00Z",
    "last_http_status": 200
  }
}
```

### 10.5 Endpoint para atualizar

```http
PATCH /api/clientes/:clienteId/integracoes
```

### 10.6 Endpoint para testar conexão

```http
POST /api/clientes/:clienteId/integracoes/:tipo/testar
```

Tipos:

```text
google_drive
n8n
meta
```

### 10.7 Segurança

- Não retornar token completo no frontend
- Só permitir revelar token para `SUPER_ADMIN`
- Registrar toda alteração em log
- Registrar teste de conexão
- Nunca usar credenciais globais para publicação de cliente

---

## 11. Tela 5 - Criação de nova postagem

### 11.1 Objetivo

Adaptar o fluxo atual de criação de postagem para o novo contexto multi-cliente.

### 11.2 Elementos identificados no modelo

A tela possui:

- Seletor de cliente ativo
- Título `New Post`
- Botões `Save Draft` e `Send for Approval`
- Área `Post Content`
- Campo `Internal Post Title`
- Campo `Instagram Caption`
- Campo `Target Client`
- Upload de mídia
- Biblioteca de mídia recente
- Prévia mobile do Instagram
- Agendamento automático
- Botão para alterar agendamento

### 11.3 Campos sugeridos

```text
Título interno
Legenda Instagram
Cliente alvo
Mídia principal
Mídias adicionais
Data de agendamento
Hora de agendamento
Status
Observações internas
```

### 11.4 Regra do cliente alvo

O campo `Target Client` deve funcionar assim:

- Para `SUPER_ADMIN`: pode selecionar qualquer cliente permitido
- Para usuário comum: cliente já vem fixo e bloqueado
- Para usuário com mais de um cliente: pode selecionar entre os clientes permitidos

Importante: o post sempre precisa ser salvo com `cliente_id`.

### 11.5 Upload de mídia

O upload deve usar a pasta Google Drive do cliente ativo.

Fluxo:

1. Usuário seleciona cliente
2. Usuário faz upload da mídia
3. Backend busca `cliente_integracoes.google_drive_folder_id`
4. Arquivo é enviado para a pasta correta
5. URL ou referência da mídia é salva no post
6. Post fica vinculado ao `cliente_id`

### 11.6 Prévia mobile

Implementar componente:

```tsx
<InstagramPreview />
```

Deve exibir:

- Avatar ou logo do cliente
- Handle do Instagram, se configurado
- Imagem ou vídeo
- Legenda
- Ícones simulados de interação
- Visual próximo ao Instagram real, mas sem depender de API externa

### 11.7 Ações

#### Salvar rascunho

Endpoint:

```http
POST /api/posts
```

Payload:

```json
{
  "cliente_id": "...",
  "titulo_interno": "...",
  "caption": "...",
  "media": [],
  "status": "RASCUNHO"
}
```

#### Enviar para aprovação

Endpoint:

```http
POST /api/posts/:postId/enviar-aprovacao
```

Ações do backend:

1. Validar que o post pertence ao cliente ativo
2. Alterar status para `PENDENTE_APROVACAO`
3. Registrar histórico
4. Registrar log
5. Disparar webhook n8n do cliente, se configurado

---

## 12. Tela 6 - Lista de clientes

Mesmo que o modelo principal enviado tenha a tela de cadastro, a plataforma precisa ter também uma tela de listagem de clientes.

### 12.1 Objetivo

Permitir que o `SUPER_ADMIN` visualize, filtre e gerencie os clientes cadastrados.

### 12.2 Elementos obrigatórios

- Busca por nome
- Filtro por status
- Cards de resumo
- Tabela de clientes
- Botão novo cliente
- Ações por cliente

### 12.3 Colunas sugeridas

```text
Cliente
Slug
Status
Usuários
Posts pendentes
Integrações
Última atividade
Ações
```

### 12.4 Ações

```text
Acessar cliente
Editar cliente
Gerenciar usuários
Gerenciar integrações
Inativar
Suspender
Ver logs
```

### 12.5 Endpoint

```http
GET /api/admin/clientes
```

---

## 13. Tela 7 - Logs

A navegação mostra a existência de uma tela de logs. Ela deve ser implementada para auditoria e suporte.

### 13.1 Objetivo

Permitir acompanhar eventos técnicos e operacionais.

### 13.2 Filtros

```text
Cliente
Usuário
Serviço
Tipo de evento
Status
Data inicial
Data final
```

### 13.3 Colunas

```text
Data
Cliente
Serviço
Evento
Status
Usuário
Detalhes
```

### 13.4 Serviços esperados

```text
auth
posts
google_drive
meta_instagram
n8n
usuarios
clientes
sistema
```

### 13.5 Endpoint

```http
GET /api/admin/logs
```

Para usuário cliente:

```http
GET /api/clientes/:clienteId/logs
```

---

## 14. Estados visuais obrigatórios

Todas as telas precisam ter estados claros.

### 14.1 Loading

Exibir skeleton ou spinner discreto.

### 14.2 Empty state

Exemplo:

```text
Nenhum cliente cadastrado ainda.
Crie o primeiro cliente para começar a operar a plataforma.
```

### 14.3 Error state

Exemplo:

```text
Não foi possível carregar os dados.
Tente novamente ou consulte os logs.
```

### 14.4 Sem permissão

Exemplo:

```text
Você não tem permissão para acessar esta área.
```

---

## 15. Responsividade

### Desktop

- Sidebar fixa
- Conteúdo em grid
- Cards em múltiplas colunas
- Tabelas completas

### Tablet

- Sidebar pode ficar compacta
- Cards em 2 colunas
- Tabelas com scroll horizontal

### Mobile

- Sidebar vira drawer
- Cards em 1 coluna
- Tabelas com primeira coluna fixa ou versão em cards
- Formulários em coluna única
- Prévia mobile pode ficar abaixo do formulário

---

## 16. Adaptação ao sistema atual

O dev não deve recriar o sistema do zero.

A orientação é aproveitar o sistema atual e evoluir a interface com base nestes modelos.

### Aproveitar do sistema atual

- Fluxo de posts
- Upload de mídia
- Aprovação
- Histórico
- Logs existentes
- Integrações já implementadas
- Publicação via Meta
- Google Drive
- n8n webhook

### Ajustar no sistema atual

- Introduzir `cliente_id`
- Criar contexto de cliente ativo
- Criar telas administrativas novas
- Ajustar permissões
- Ajustar endpoints
- Ajustar layout
- Separar integrações por cliente

---

## 17. Rotas frontend sugeridas

```text
/admin/dashboard
/admin/clientes
/admin/clientes/novo
/admin/clientes/:clienteId
/admin/clientes/:clienteId/usuarios
/admin/clientes/:clienteId/integracoes
/admin/logs

/app/dashboard
/app/postagens
/app/postagens/nova
/app/postagens/:postId
/app/usuarios
/app/integracoes
/app/logs
```

### Observação

O prefixo `/admin` deve ser usado para telas globais.

O prefixo `/app` deve ser usado para telas do cliente ativo.

---

## 18. APIs sugeridas

### Clientes

```http
GET /api/admin/clientes
POST /api/admin/clientes
GET /api/admin/clientes/:clienteId
PATCH /api/admin/clientes/:clienteId
DELETE /api/admin/clientes/:clienteId
```

### Usuários do cliente

```http
GET /api/clientes/:clienteId/usuarios
POST /api/clientes/:clienteId/usuarios/convites
PATCH /api/clientes/:clienteId/usuarios/:usuarioId
DELETE /api/clientes/:clienteId/usuarios/:usuarioId
```

### Integrações

```http
GET /api/clientes/:clienteId/integracoes
PATCH /api/clientes/:clienteId/integracoes
POST /api/clientes/:clienteId/integracoes/google_drive/testar
POST /api/clientes/:clienteId/integracoes/meta/testar
POST /api/clientes/:clienteId/integracoes/n8n/testar
```

### Posts

```http
GET /api/clientes/:clienteId/posts
POST /api/clientes/:clienteId/posts
GET /api/clientes/:clienteId/posts/:postId
PATCH /api/clientes/:clienteId/posts/:postId
POST /api/clientes/:clienteId/posts/:postId/enviar-aprovacao
POST /api/clientes/:clienteId/posts/:postId/aprovar
POST /api/clientes/:clienteId/posts/:postId/rejeitar
POST /api/clientes/:clienteId/posts/:postId/publicar
```

### Logs

```http
GET /api/admin/logs
GET /api/clientes/:clienteId/logs
```

---

## 19. Contexto global de cliente no frontend

Criar um provider para controlar o cliente ativo.

Exemplo:

```tsx
<ClientContextProvider>
  <AppShell />
</ClientContextProvider>
```

Estado:

```ts
type ClientContextState = {
  activeClient: ActiveClient | null;
  availableClients: ActiveClient[];
  setActiveClient: (clientId: string) => Promise<void>;
  isSuperAdmin: boolean;
};
```

Toda chamada de API deve usar o cliente ativo.

Opções:

1. Enviar `clienteId` na URL
2. Enviar header `x-cliente-id`
3. Usar ambos para reforço

Recomendação: usar `clienteId` na URL para clareza e validar no backend.

---

## 20. Auditoria

Criar ou reforçar uma rotina de auditoria.

Ações que devem gerar log:

```text
Cliente criado
Cliente editado
Cliente inativado
Usuário convidado
Usuário teve perfil alterado
Usuário foi inativado
Integração alterada
Teste de integração executado
Post criado
Post enviado para aprovação
Post aprovado
Post rejeitado
Post publicado
Erro de publicação
Troca de modo SIMULADOR para REAL
```

Campos mínimos do log:

```text
cliente_id
usuario_id
servico
acao
mensagem
payload
created_at
```

---

## 21. Integração com o modelo multi-cliente do banco

Este documento considera que o banco terá no mínimo as tabelas:

```text
clientes
cliente_usuarios
cliente_integracoes
posts
historico_posts
logs
usuarios
```

Campos obrigatórios já previstos:

```text
posts.cliente_id
historico_posts.cliente_id
logs.cliente_id
cliente_integracoes.cliente_id
cliente_usuarios.cliente_id
```

O dev deve garantir que nenhuma tela nova seja implementada sem respeitar essa separação.

---

## 22. Prioridade de implementação

### Prioridade 1

Implementar primeiro:

```text
AppShell
Sidebar
Topbar
ClientSelector
Dashboard global
Cadastro de cliente
Lista de clientes
Contexto de cliente ativo
```

Motivo: isso cria a base visual e operacional da plataforma.

### Prioridade 2

Implementar:

```text
Gestão de usuários do cliente
Integrações do cliente
Logs
```

Motivo: isso permite operar clientes diferentes com controle e segurança.

### Prioridade 3

Implementar:

```text
Nova tela de criação de postagem
Prévia mobile
Upload por cliente
Envio para aprovação por cliente
```

Motivo: essa fase conecta a nova interface ao fluxo principal do sistema.

### Prioridade 4

Implementar:

```text
Refinamento visual
Responsividade
Personalização por cliente
Relatórios
Indicadores avançados
```

---

## 23. Critérios de aceite por tela

### Dashboard global

Aprovado quando:

- Mostra indicadores globais reais
- Mostra atividade recente dos clientes
- Só é acessível por `SUPER_ADMIN`
- Permite navegar para clientes, posts e logs

### Cadastro de cliente

Aprovado quando:

- Cria cliente
- Cria integração inicial
- Valida campos obrigatórios
- Salva logo e cores
- Registra log da criação
- Não permite slug duplicado

### Usuários do cliente

Aprovado quando:

- Lista usuários do cliente ativo
- Convida novo usuário
- Altera perfil
- Inativa usuário
- Bloqueia criação indevida de `SUPER_ADMIN`
- Registra auditoria

### Integrações do cliente

Aprovado quando:

- Exibe status das integrações
- Permite editar configurações
- Testa Google Drive
- Testa Meta/Instagram
- Testa n8n
- Não expõe tokens completos
- Usa as credenciais do cliente ativo

### Nova postagem

Aprovado quando:

- Cria post vinculado ao cliente
- Faz upload na pasta do cliente
- Exibe prévia mobile
- Salva rascunho
- Envia para aprovação
- Dispara webhook correto
- Não permite cliente acessar post de outro cliente

---

## 24. Observações sobre os arquivos enviados

Os arquivos enviados trazem uma boa referência de UI para a plataforma.

Foram identificadas telas completas para:

```text
Cadastro de Cliente
Gestão de Usuários
Integrações
Nova Postagem
Dashboard Global
```

Alguns arquivos ZIP possuem apenas o `DESIGN.md` e uma imagem inválida ou não renderizada. Nesses casos, usar o conteúdo do `DESIGN.md` como referência de design system, paleta, tipografia e layout.

---

## 25. Recomendação final ao dev

Não implementar essas telas como HTML solto.

O dev deve transformar os modelos em componentes reais do projeto atual.

Ordem prática:

1. Criar design tokens globais
2. Criar AppShell
3. Criar Sidebar
4. Criar Topbar
5. Criar ClientSelector
6. Criar componentes base
7. Criar Dashboard global
8. Criar Lista de clientes
9. Criar Cadastro de cliente
10. Criar Usuários do cliente
11. Criar Integrações do cliente
12. Criar Logs
13. Adaptar tela de Nova Postagem
14. Conectar tudo às APIs multi-cliente
15. Testar permissões e isolamento de dados

---

## 26. Resultado esperado

Ao final, o sistema atual deixará de parecer uma ferramenta isolada de aprovação de posts e passará a se comportar como um portal de gestão multi-cliente.

O Christian terá uma visão central de todos os clientes, poderá cadastrar novas operações, controlar acessos, configurar integrações e acompanhar publicações de forma separada.

Cada cliente terá seu ambiente próprio, com usuários, posts, integrações, histórico e logs isolados.

Esse é o passo necessário para transformar a ferramenta em uma plataforma comercial gerenciada.
