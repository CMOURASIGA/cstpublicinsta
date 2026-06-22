create extension if not exists pgcrypto;

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  pessoa_id uuid,
  nome text not null,
  email text not null unique,
  perfil text not null default 'OPERADOR',
  status text not null default 'ATIVO',
  origem_dado text not null default 'SISTEMA',
  data_importacao timestamptz,
  id_origem_planilha text,
  ultima_sincronizacao timestamptz,
  criado_via_sistema boolean not null default true,
  perfil_publicacao text not null default 'CRIADOR' check (perfil_publicacao in ('CRIADOR', 'APROVADOR', 'ADMIN')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table usuarios
  add column if not exists perfil_publicacao text not null default 'CRIADOR';

alter table usuarios
  drop constraint if exists usuarios_perfil_publicacao_check;

alter table usuarios
  add constraint usuarios_perfil_publicacao_check
  check (perfil_publicacao in ('CRIADOR', 'APROVADOR', 'ADMIN'));

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  legenda text not null default '',
  tipo text not null check (tipo in ('IMAGEM', 'VIDEO', 'REELS')),
  drive_file_id text,
  drive_url text,
  creation_id text,
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO', 'PENDENTE', 'APROVADA', 'REJEITADA', 'AGENDADA', 'PUBLICADA', 'ERRO')),
  instagram_post_id text,
  data_agendamento timestamptz,
  data_publicacao timestamptz,
  hashtags text,
  criado_por_nome text,
  erro_detalhe text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists historico_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  post_titulo text,
  usuario text not null,
  acao text not null,
  observacao text,
  criado_em timestamptz not null default now()
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  service text not null check (service in ('Google Drive', 'Instagram API', 'Scheduler', 'Gemini AI', 'Database')),
  type text not null check (type in ('info', 'success', 'warn', 'error')),
  message text not null,
  payload text
);

create index if not exists posts_status_idx on posts(status);
create index if not exists posts_drive_file_id_idx on posts(drive_file_id);
create index if not exists historico_posts_post_id_idx on historico_posts(post_id);
create index if not exists logs_timestamp_idx on logs(timestamp desc);
