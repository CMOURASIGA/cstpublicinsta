export type PerfilPublicacao = 'SUPER_ADMIN' | 'ADMIN' | 'ADMIN_CLIENTE' | 'APROVADOR' | 'CRIADOR' | 'VISUALIZADOR';

export interface Usuario {
  id: string; // UUID or string
  auth_user_id?: string;
  nome: string;
  email: string;
  perfil: 'USUARIO' | 'ADMINISTRADOR';
  perfil_publicacao?: PerfilPublicacao;
  ativo: boolean;
  criado_em: string;
}

export interface Cliente {
  id: string;
  nome: string;
  slug: string;
  status: 'ATIVO' | 'INATIVO' | 'SUSPENSO';
  logo_url?: string | null;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ClienteUsuario {
  id: string;
  cliente_id: string;
  usuario_id: string;
  perfil: 'SUPER_ADMIN' | 'ADMIN_CLIENTE' | 'CRIADOR' | 'APROVADOR' | 'VISUALIZADOR';
  status: 'ATIVO' | 'INATIVO';
  criado_em: string;
}

export interface ClienteIntegracao {
  id: string;
  cliente_id: string;
  google_account_email?: string | null;
  google_drive_access_token_encrypted?: string | null;
  google_drive_refresh_token_encrypted?: string | null;
  google_drive_token_expires_at?: string | null;
  google_drive_status?: 'NAO_CONECTADO' | 'CONECTADO' | 'ERRO' | 'EXPIRADO' | 'DESCONECTADO' | 'ATIVO';
  google_drive_last_sync_at?: string | null;
  google_drive_last_error?: string | null;
  google_drive_folder_id?: string | null;
  google_drive_entrada_folder_id?: string | null;
  google_drive_aprovacao_folder_id?: string | null;
  google_drive_aprovados_folder_id?: string | null;
  google_drive_publicados_folder_id?: string | null;
  google_drive_rejeitados_folder_id?: string | null;
  google_drive_arquivados_folder_id?: string | null;
  google_drive_imagens_folder_id?: string | null;
  google_drive_videos_folder_id?: string | null;
  instagram_username?: string | null;
  instagram_access_token?: string | null;
  instagram_access_token_encrypted?: string | null;
  instagram_token_status?: 'NAO_CONFIGURADO' | 'ATIVO' | 'ATIVO_TESTE' | 'EXPIRADO' | 'ERRO' | 'DESCONECTADO';
  instagram_token_expires_at?: string | null;
  instagram_connected_at?: string | null;
  instagram_last_sync_at?: string | null;
  instagram_connection_mode?: 'INSTAGRAM_LOGIN' | 'FACEBOOK_LOGIN' | 'MANUAL_TEST_TOKEN';
  instagram_webhook_enabled?: boolean | null;
  instagram_user_id?: string | null;
  instagram_business_id?: string | null;
  instagram_media_actor_id?: string | null;
  facebook_page_id?: string | null;
  graph_api_version?: string | null;
  modo_operacao?: 'SIMULADOR' | 'REAL';
  criado_em: string;
  atualizado_em: string;
}

export interface SistemaConfiguracao {
  id: string;
  chave: string;
  valor?: string | null;
  valor_encrypted?: string | null;
  tipo: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'SECRET';
  categoria: string;
  descricao?: string | null;
  sensivel: boolean;
  editavel: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ClienteConfiguracao {
  id: string;
  cliente_id: string;
  chave: string;
  valor?: string | null;
  valor_encrypted?: string | null;
  tipo: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'SECRET';
  categoria: string;
  descricao?: string | null;
  sensivel: boolean;
  editavel_por_cliente: boolean;
  usar_padrao_sistema: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ParametroAuditoria {
  id: string;
  escopo: 'SISTEMA' | 'CLIENTE' | 'INTEGRACAO' | 'IA' | 'APROVACAO';
  cliente_id?: string | null;
  usuario_id?: string | null;
  chave: string;
  categoria?: string | null;
  valor_anterior_mascarado?: string | null;
  valor_novo_mascarado?: string | null;
  acao: 'CRIADO' | 'ALTERADO' | 'REMOVIDO' | 'TESTADO';
  origem?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  criado_em: string;
}

export interface ClienteDriveArquivo {
  id: string;
  cliente_id: string;
  post_id?: string | null;
  drive_file_id: string;
  drive_folder_id?: string | null;
  drive_file_name?: string | null;
  drive_mime_type?: string | null;
  drive_web_view_link?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  storage_public_url?: string | null;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  origem: 'GOOGLE_DRIVE' | 'UPLOAD_DIRETO' | 'LINK_EXTERNO';
  status: 'IMPORTADO' | 'EM_APROVACAO' | 'APROVADO' | 'PUBLICADO' | 'REJEITADO' | 'ARQUIVADO' | 'ERRO';
  raw_payload?: Record<string, unknown> | null;
  criado_em: string;
  atualizado_em: string;
}

export interface GoogleDriveOauthState {
  id: string;
  state: string;
  cliente_id: string;
  usuario_id?: string | null;
  redirect_after_success?: string | null;
  expires_at: string;
  used_at?: string | null;
  criado_em: string;
}

export interface InstagramOauthState {
  id: string;
  state: string;
  cliente_id: string;
  usuario_id?: string | null;
  provider: 'INSTAGRAM_LOGIN' | 'FACEBOOK_LOGIN';
  redirect_after_success?: string | null;
  expires_at: string;
  used_at?: string | null;
  criado_em: string;
}

export type PostStatus =
  | 'RASCUNHO'
  | 'PENDENTE'
  | 'PENDENTE_APROVACAO'
  | 'APROVADA'
  | 'APROVADO'
  | 'REJEITADA'
  | 'REJEITADO'
  | 'AGENDADA'
  | 'AGENDADO'
  | 'PUBLICADA'
  | 'PUBLICADO'
  | 'ERRO'
  | 'ERRO_PUBLICACAO'
  | 'CANCELADO';
export type MediaValidationStatus = 'VALID' | 'VALID_WITH_WARNINGS' | 'INVALID';

export interface MediaValidationIssue {
  code: string;
  message: string;
}

export interface MediaMetadata {
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  duration_seconds?: number;
  aspect_ratio?: number;
  orientation?: 'vertical' | 'horizontal' | 'square' | 'unknown';
  has_audio?: boolean;
  source?: 'browser' | 'backend' | 'external';
}

export interface VideoEditMetadata {
  edited?: boolean;
  tool?: string;
  trim_start_sec?: number;
  trim_end_sec?: number;
  thumbnail_time_sec?: number;
  created_in_browser?: boolean;
  original_filename?: string;
  final_filename?: string;
}

export interface Post {
  id: string; // UUID
  cliente_id?: string | null;
  titulo: string;
  legenda: string;
  tipo: 'IMAGEM' | 'VIDEO' | 'REELS';
  drive_file_id?: string;
  drive_url?: string;
  creation_id?: string;
  status: PostStatus;
  instagram_post_id?: string;
  instagram_media_id?: string | null;
  instagram_permalink?: string | null;
  instagram_published_at?: string | null;
  instagram_publish_status?: 'NAO_PUBLICADO' | 'PUBLICANDO' | 'PUBLICADO' | 'ERRO_PUBLICACAO' | null;
  instagram_publish_error?: string | null;
  data_agendamento?: string; // ISO String
  data_publicacao?: string; // ISO String
  criado_em: string;
  atualizado_em: string;
  hashtags?: string; // separated by spaces/commas
  criado_por_nome?: string;
  erro_detalhe?: string;
  media_validation_status?: MediaValidationStatus | null;
  media_validation_errors?: MediaValidationIssue[];
  media_validation_warnings?: MediaValidationIssue[];
  media_metadata?: MediaMetadata;
  video_original_drive_file_id?: string | null;
  video_original_drive_url?: string | null;
  video_editado_drive_file_id?: string | null;
  video_editado_drive_url?: string | null;
  trim_start_sec?: number | null;
  trim_end_sec?: number | null;
  video_original_duration_sec?: number | null;
  video_final_duration_sec?: number | null;
  thumbnail_drive_file_id?: string | null;
  thumbnail_drive_url?: string | null;
  thumbnail_time_sec?: number | null;
  video_edit_metadata?: VideoEditMetadata;
}

export interface PostInsightResumo {
  id: string;
  cliente_id: string;
  post_id: string;
  instagram_media_id: string;
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saved?: number | null;
  total_interactions?: number | null;
  engagement_rate?: number | null;
  last_sync_at?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

export interface HistoricoPost {
  id: string;
  cliente_id?: string | null;
  post_id: string;
  post_titulo?: string;
  usuario: string; // Name of person who did the action
  acao: string; // e.g. "Criação de Post", "Edição de legenda", "Envio para Aprovação", "Rejeitado", "Aprovado", "Publicado"
  observacao?: string;
  criado_em: string;
}

export interface SettingsConfig {
  mode: 'SIMULATOR' | 'REAL';
  operationalMode: 'SIMULATOR' | 'REAL';
  appUrl: string;
  supabaseUrl: string;
  supabaseConfigured: boolean;
  supabaseSchemaReady: boolean;
  missingSupabaseTables: string[];
  googleDriveFolderId: string;
  googleConfigured: boolean;
  instagramBusinessId: string;
  instagramGraphBaseUrl?: string;
  facebookPageId: string;
  instagramConfigured: boolean;
  geminiModel: string;
  geminiConfigured: boolean;
  graphApiVersion: string;
  secretsStoredInBackend: boolean;
  readOnly: boolean;
  missingEnv: string[];
}

export interface SystemSettingsView {
  items: SistemaConfiguracao[];
}

export interface ClientSettingsView {
  cliente: Cliente;
  configuracoes: ClienteConfiguracao[];
  integracoes: ClienteIntegracao | null;
  auditoria: ParametroAuditoria[];
}

export interface LogMessage {
  id: string;
  cliente_id?: string | null;
  timestamp: string;
  service: 'Google Drive' | 'Instagram API' | 'Scheduler' | 'Gemini AI' | 'Database' | 'Clientes';
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  payload?: string;
}
