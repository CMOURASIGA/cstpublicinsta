export type PerfilPublicacao = 'CRIADOR' | 'APROVADOR' | 'ADMIN';

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

export type PostStatus = 'RASCUNHO' | 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'AGENDADA' | 'PUBLICADA' | 'ERRO';

export interface Post {
  id: string; // UUID
  titulo: string;
  legenda: string;
  tipo: 'IMAGEM' | 'VIDEO' | 'REELS';
  drive_file_id?: string;
  drive_url?: string;
  creation_id?: string;
  status: PostStatus;
  instagram_post_id?: string;
  data_agendamento?: string; // ISO String
  data_publicacao?: string; // ISO String
  criado_em: string;
  atualizado_em: string;
  hashtags?: string; // separated by spaces/commas
  criado_por_nome?: string;
  erro_detalhe?: string;
}

export interface HistoricoPost {
  id: string;
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
  facebookPageId: string;
  instagramConfigured: boolean;
  geminiModel: string;
  geminiConfigured: boolean;
  graphApiVersion: string;
  secretsStoredInBackend: boolean;
  readOnly: boolean;
  missingEnv: string[];
}

export interface LogMessage {
  id: string;
  timestamp: string;
  service: 'Google Drive' | 'Instagram API' | 'Scheduler' | 'Gemini AI' | 'Database';
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  payload?: string;
}
