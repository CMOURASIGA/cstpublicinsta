export interface Usuario {
  id: string; // UUID or string
  nome: string;
  email: string;
  perfil: 'USUARIO' | 'ADMINISTRADOR';
  ativo: boolean;
  criado_em: string;
}

export type PostStatus = 'RASCUNHO' | 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'AGENDADA' | 'PUBLICADA' | 'ERRO';

export interface Post {
  id: string; // UUID
  titulo: string;
  legenda: string;
  tipo: 'IMAGEM' | 'VIDEO';
  drive_file_id?: string;
  drive_url?: string;
  status: PostStatus;
  instagram_post_id?: string;
  data_agendamento?: string; // ISO String
  data_publicacao?: string; // ISO String
  criado_em: string;
  atualizado_em: string;
  hashtags?: string; // separated by spaces/commas
  criado_por_nome?: string;
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
  supabaseUrl: string;
  supabaseKey: string;
  googleDriveFolderId: string;
  instagramAccessToken: string;
  instagramBusinessId: string;
  geminiModel: string;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  service: 'Google Drive' | 'Instagram API' | 'Scheduler' | 'Gemini AI' | 'Database';
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  payload?: string;
}
