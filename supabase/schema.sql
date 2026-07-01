create extension if not exists pgcrypto;

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

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  nome text not null,
  email text not null unique,
  perfil text not null default 'USUARIO' check (perfil in ('USUARIO', 'ADMINISTRADOR')),
  perfil_publicacao text check (perfil_publicacao in ('SUPER_ADMIN', 'ADMIN', 'ADMIN_CLIENTE', 'APROVADOR', 'CRIADOR', 'VISUALIZADOR')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists cliente_usuarios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  perfil text not null check (perfil in ('SUPER_ADMIN', 'ADMIN_CLIENTE', 'CRIADOR', 'APROVADOR', 'VISUALIZADOR')),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  criado_em timestamptz not null default now(),
  unique (cliente_id, usuario_id)
);

create table if not exists cliente_integracoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade unique,
  google_drive_folder_id text,
  google_drive_imagens_folder_id text,
  google_drive_videos_folder_id text,
  google_drive_publicados_folder_id text,
  instagram_access_token text,
  instagram_user_id text,
  instagram_business_id text,
  facebook_page_id text,
  graph_api_version text default 'v23.0',
  modo_operacao text not null default 'SIMULADOR' check (modo_operacao in ('SIMULADOR', 'REAL')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists sistema_configuracoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  valor text,
  valor_encrypted text,
  tipo text not null default 'STRING' check (tipo in ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET')),
  categoria text not null default 'GERAL',
  descricao text,
  sensivel boolean not null default false,
  editavel boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists cliente_configuracoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  chave text not null,
  valor text,
  valor_encrypted text,
  tipo text not null default 'STRING' check (tipo in ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET')),
  categoria text not null default 'GERAL',
  descricao text,
  sensivel boolean not null default false,
  editavel_por_cliente boolean not null default false,
  usar_padrao_sistema boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cliente_id, chave)
);

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

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  titulo text not null,
  legenda text not null default '',
  tipo text not null check (tipo in ('IMAGEM', 'VIDEO', 'REELS')),
  drive_file_id text,
  drive_url text,
  creation_id text,
  status text not null default 'RASCUNHO',
  instagram_post_id text,
  data_agendamento timestamptz,
  data_publicacao timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  hashtags text,
  criado_por_nome text,
  erro_detalhe text,
  media_validation_status text,
  media_validation_errors jsonb,
  media_validation_warnings jsonb,
  media_metadata jsonb,
  video_original_drive_file_id text,
  video_original_drive_url text,
  video_editado_drive_file_id text,
  video_editado_drive_url text,
  trim_start_sec numeric,
  trim_end_sec numeric,
  video_original_duration_sec numeric,
  video_final_duration_sec numeric,
  thumbnail_drive_file_id text,
  thumbnail_drive_url text,
  thumbnail_time_sec numeric,
  video_edit_metadata jsonb
);

create table if not exists historico_posts (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  post_id uuid not null,
  post_titulo text,
  usuario text not null,
  acao text not null,
  observacao text,
  criado_em timestamptz not null default now()
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  timestamp timestamptz not null default now(),
  service text not null,
  type text not null,
  message text not null,
  payload text
);

alter table if exists posts add column if not exists cliente_id uuid references clientes(id);
alter table if exists historico_posts add column if not exists cliente_id uuid references clientes(id);
alter table if exists logs add column if not exists cliente_id uuid references clientes(id);

create index if not exists idx_posts_cliente_id on posts(cliente_id);
create index if not exists idx_posts_cliente_status on posts(cliente_id, status);
create index if not exists idx_historico_cliente_id on historico_posts(cliente_id);
create index if not exists idx_logs_cliente_id on logs(cliente_id);
create index if not exists idx_cliente_usuarios_cliente_id on cliente_usuarios(cliente_id);
create index if not exists idx_cliente_usuarios_usuario_id on cliente_usuarios(usuario_id);
create index if not exists idx_cliente_configuracoes_cliente_id on cliente_configuracoes(cliente_id);
create index if not exists idx_parametro_auditoria_cliente_id on parametro_auditoria(cliente_id);
create index if not exists idx_parametro_auditoria_escopo on parametro_auditoria(escopo);
create index if not exists idx_parametro_auditoria_chave on parametro_auditoria(chave);
create index if not exists idx_parametro_auditoria_criado_em on parametro_auditoria(criado_em);
create index if not exists idx_usuarios_email on usuarios(email);
create index if not exists idx_usuarios_auth_user_id on usuarios(auth_user_id);

insert into clientes (nome, slug, status)
values ('Cliente Inicial', 'cliente-inicial', 'ATIVO')
on conflict (slug) do nothing;

insert into cliente_integracoes (cliente_id)
select id
from clientes
where slug = 'cliente-inicial'
on conflict (cliente_id) do nothing;

insert into sistema_configuracoes (chave, valor, tipo, categoria, descricao, sensivel, editavel)
values
('APP_URL', '', 'STRING', 'GERAL', 'URL pública da aplicação', false, false),
('SUPABASE_URL', '', 'STRING', 'GERAL', 'URL do Supabase', false, false),
('INSTAGRAM_GRAPH_BASE_URL', 'https://graph.facebook.com', 'STRING', 'META', 'Base URL global da Graph API', false, false),
('GRAPH_API_VERSION_DEFAULT', 'v23.0', 'STRING', 'META', 'Versão padrão da Graph API', false, true),
('SECRET_STORAGE_MODE', 'BACKEND_ONLY', 'STRING', 'SEGURANCA', 'Modo de armazenamento de segredos', false, false)
on conflict (chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente)
select id, 'MODO_OPERACAO', 'SIMULADOR', 'STRING', 'OPERACAO', 'Modo operacional padrão do cliente', false, false
from clientes
where slug = 'cliente-inicial'
on conflict (cliente_id, chave) do nothing;

insert into sistema_configuracoes (chave, valor, valor_encrypted, tipo, categoria, descricao, sensivel, editavel)
values
('SUPABASE_ANON_KEY', '', '', 'SECRET', 'BANCO', 'Chave publica do Supabase', true, false),
('GRAPH_API_VERSION', 'v23.0', null, 'STRING', 'META', 'Versao padrao da Graph API', false, false),
('DEFAULT_CLIENT_SLUG', 'cliente-inicial', null, 'STRING', 'CLIENTES', 'Slug padrao carregado apos autenticacao', false, false),
('GOOGLE_CLIENT_ID', '', null, 'STRING', 'GOOGLE', 'Client ID global do Google OAuth', false, false),
('GOOGLE_REDIRECT_URI', '', null, 'STRING', 'GOOGLE', 'Redirect URI global do Google OAuth', false, false),
('GOOGLE_CLIENT_EMAIL', '', null, 'STRING', 'GOOGLE', 'Conta de servico global do Google Drive', false, false),
('META_APP_ID', '', null, 'STRING', 'META', 'App ID global da Meta', false, false),
('META_REDIRECT_URI', '', null, 'STRING', 'META', 'Redirect URI global da Meta', false, false),
('META_VERIFY_TOKEN', '', '', 'SECRET', 'META', 'Token global de verificacao da Meta', true, false),
('AI_DEFAULT_PROVIDER', 'GEMINI', null, 'STRING', 'IA', 'Provedor padrao do sistema', false, false),
('AI_DEFAULT_MODEL', 'gemini-2.5-flash', null, 'STRING', 'IA', 'Modelo padrao do sistema', false, false),
('AI_PROVIDER_OPTIONS', 'GEMINI,OPENAI,ANTHROPIC,DEEPSEEK,GROK,AZURE_OPENAI', null, 'STRING', 'IA', 'Lista de provedores habilitados', false, false),
('CLIENT_INTEGRATIONS_STORAGE', 'SUPABASE', null, 'STRING', 'SEGURANCA', 'Origem das credenciais por cliente', false, false)
on conflict (chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'PROVEDOR_IA', 'GEMINI', 'STRING', 'IA', 'Provedor padrao do cliente', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'MODELO_IA', 'gemini-2.5-flash', 'STRING', 'IA', 'Modelo padrao do cliente', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'PROMPT_BASE', '', 'JSON', 'IA', 'Prompt base do cliente', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'TEMPERATURA', '0.4', 'NUMBER', 'IA', 'Temperatura do modelo', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, valor_encrypted, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'IA_API_KEY', null, null, 'SECRET', 'IA', 'Chave do provedor selecionado', true, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'EXIGE_APROVACAO', 'true', 'BOOLEAN', 'APROVACAO', 'Exige aprovacao antes da publicacao', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'NUMERO_MINIMO_APROVADORES', '1', 'NUMBER', 'APROVACAO', 'Quantidade minima de aprovadores', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'PERMITE_PUBLICACAO_DIRETA', 'true', 'BOOLEAN', 'APROVACAO', 'Aprovadores podem publicar diretamente', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'NOTIFICAR_APROVADORES', 'true', 'BOOLEAN', 'APROVACAO', 'Notifica aprovadores', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;

insert into cliente_configuracoes (cliente_id, chave, valor, tipo, categoria, descricao, sensivel, editavel_por_cliente, usar_padrao_sistema)
select id, 'NOTIFICAR_CRIADOR', 'true', 'BOOLEAN', 'APROVACAO', 'Notifica criador', false, true, true
from clientes
on conflict (cliente_id, chave) do nothing;
