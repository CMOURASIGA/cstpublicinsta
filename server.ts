import { createHmac, createSign, randomUUID } from "crypto";
import express from "express";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import dotenv from "dotenv";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import {
  Cliente,
  ClienteConfiguracao,
  ClienteDriveArquivo,
  ClienteIntegracao,
  ClienteUsuario,
  GoogleDriveOauthState,
  InstagramOauthState,
  HistoricoPost,
  LogMessage,
  ParametroAuditoria,
  PerfilPublicacao,
  Post,
  PostInsightResumo,
  PostStatus,
  SettingsConfig,
  SistemaConfiguracao,
  Usuario,
} from "./src/types";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "60mb" }));

type RuntimeMode = "SIMULATOR" | "REAL";

interface RuntimeConfig {
  appUrl: string;
  appUrlIsPublic: boolean;
  mode: RuntimeMode;
  operationalMode: RuntimeMode;
  graphApiVersion: string;
  geminiModel: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  googleRedirectUri: string;
  googleClientEmail: string;
  googlePrivateKey: string;
  googleDriveFolderId: string;
  defaultClientSlug: string;
  metaAppId: string;
  metaAppSecret: string;
  metaRedirectUri: string;
  instagramAppId: string;
  instagramAppSecret: string;
  instagramRedirectUri: string;
  instagramAccessToken: string;
  instagramUserId: string;
  instagramBusinessId: string;
  instagramGraphBaseUrl: string;
  facebookPageId: string;
  metaVerifyToken: string;
  mediaUrlSigningSecret: string;
  supabaseConfigured: boolean;
  googleConfigured: boolean;
  instagramConfigured: boolean;
  geminiConfigured: boolean;
  missingEnv: string[];
}

interface MemoryStore {
  clientes: Cliente[];
  sistemaConfiguracoes: SistemaConfiguracao[];
  clienteConfiguracoes: ClienteConfiguracao[];
  clienteIntegracoes: ClienteIntegracao[];
  clienteDriveArquivos: ClienteDriveArquivo[];
  googleDriveOauthStates: GoogleDriveOauthState[];
  instagramOauthStates: InstagramOauthState[];
  clienteUsuarios: ClienteUsuario[];
  parametroAuditoria: ParametroAuditoria[];
  postInsightsResumo: PostInsightResumo[];
  posts: Post[];
  usuarios: Usuario[];
  historicos: HistoricoPost[];
  logs: LogMessage[];
}

interface SupabaseSchemaState {
  ready: boolean;
  missingTables: string[];
  checkedAt: number;
}

interface ActingUser {
  id: string;
  nome: string;
  email: string;
  perfil: Usuario["perfil"];
  perfil_publicacao: PerfilPublicacao;
  ativo: boolean;
}

interface AuthenticatedSupabaseUser {
  id: string;
  email: string;
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface GoogleAccessTokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

interface DriveFolderMap {
  rootId: string;
  entradaId: string;
  aprovacaoId: string;
  aprovadosId: string;
  publicadosId: string;
  rejeitadosId: string;
  arquivadosId: string;
}

interface ClienteOperationalContext {
  clienteId: string | null;
  driveRootId: string;
  driveEntradaId: string;
  driveAprovacaoId: string;
  driveAprovadosId: string;
  drivePublishedId: string;
  driveRejeitadosId: string;
  driveArquivadosId: string;
  googleRefreshToken: string;
  googleDriveStatus: string;
  googleAccountEmail: string;
  graphApiVersion: string;
  instagramUsername: string;
  instagramAccessToken: string;
  instagramTokenExpiresAt: string;
  instagramUserId: string;
  instagramBusinessId: string;
  instagramConnectionMode: string;
  instagramTokenStatus: string;
  facebookPageId: string;
  instagramGraphBaseUrl: string;
  googleConfigured: boolean;
  instagramConfigured: boolean;
  aiProvider: string;
  aiModel: string;
  aiApiKey: string;
  aiConfigured: boolean;
  modoOperacao: RuntimeMode;
}

interface GoogleDriveProfile {
  email?: string;
  name?: string;
}

const defaultUsers: Usuario[] = [
  {
    id: "user-admin-cmoura",
    nome: "Christian Moura",
    email: "cmourasiga@gmail.com",
    perfil: "ADMINISTRADOR",
    perfil_publicacao: "ADMIN",
    ativo: true,
    criado_em: new Date().toISOString(),
  },
];

const defaultClientes: Cliente[] = [
  {
    id: "cliente-inicial-id",
    nome: "Cliente Inicial",
    slug: "cliente-inicial",
    status: "ATIVO",
    logo_url: null,
    cor_primaria: "#001836",
    cor_secundaria: "#0060ac",
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
];

const CLIENTE_CONFIG_DEFAULTS: Array<
  Omit<ClienteConfiguracao, "id" | "cliente_id" | "criado_em" | "atualizado_em">
> = [
  {
    chave: "MODO_OPERACAO",
    valor: "SIMULADOR",
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "GERAL",
    descricao: "Modo operacional do cliente.",
    sensivel: false,
    editavel_por_cliente: false,
    usar_padrao_sistema: false,
  },
  {
    chave: "PROVEDOR_IA",
    valor: trimEnv(process.env.AI_DEFAULT_PROVIDER) || "GEMINI",
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "IA",
    descricao: "Provedor padrao do cliente.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "MODELO_IA",
    valor: trimEnv(process.env.AI_DEFAULT_MODEL) || "gemini-2.5-flash",
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "IA",
    descricao: "Modelo padrao do cliente.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "PROMPT_BASE",
    valor: "",
    valor_encrypted: null,
    tipo: "JSON",
    categoria: "IA",
    descricao: "Prompt base do cliente.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "TEMPERATURA",
    valor: "0.4",
    valor_encrypted: null,
    tipo: "NUMBER",
    categoria: "IA",
    descricao: "Temperatura do modelo.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "IA_API_KEY",
    valor: null,
    valor_encrypted: null,
    tipo: "SECRET",
    categoria: "IA",
    descricao: "Chave do provedor selecionado.",
    sensivel: true,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "EXIGE_APROVACAO",
    valor: "true",
    valor_encrypted: null,
    tipo: "BOOLEAN",
    categoria: "APROVACAO",
    descricao: "Exige aprovacao antes da publicacao.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "NUMERO_MINIMO_APROVADORES",
    valor: "1",
    valor_encrypted: null,
    tipo: "NUMBER",
    categoria: "APROVACAO",
    descricao: "Quantidade minima de aprovadores.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "PERMITE_PUBLICACAO_DIRETA",
    valor: "true",
    valor_encrypted: null,
    tipo: "BOOLEAN",
    categoria: "APROVACAO",
    descricao: "Aprovadores podem publicar diretamente.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "NOTIFICAR_APROVADORES",
    valor: "true",
    valor_encrypted: null,
    tipo: "BOOLEAN",
    categoria: "APROVACAO",
    descricao: "Notifica aprovadores.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "NOTIFICAR_CRIADOR",
    valor: "true",
    valor_encrypted: null,
    tipo: "BOOLEAN",
    categoria: "APROVACAO",
    descricao: "Notifica criador.",
    sensivel: false,
    editavel_por_cliente: true,
    usar_padrao_sistema: true,
  },
  {
    chave: "GOOGLE_DRIVE_STATUS",
    valor: "NAO_CONECTADO",
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "INTEGRACAO",
    descricao: "Status operacional do Google Drive do cliente.",
    sensivel: false,
    editavel_por_cliente: false,
    usar_padrao_sistema: false,
  },
  {
    chave: "GOOGLE_OAUTH_ACCOUNT_EMAIL",
    valor: "",
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "INTEGRACAO",
    descricao: "Conta Google conectada ao cliente.",
    sensivel: false,
    editavel_por_cliente: false,
    usar_padrao_sistema: false,
  },
  {
    chave: "GOOGLE_OAUTH_CONNECTED_AT",
    valor: "",
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "INTEGRACAO",
    descricao: "Data da ultima conexao Google.",
    sensivel: false,
    editavel_por_cliente: false,
    usar_padrao_sistema: false,
  },
  {
    chave: "GOOGLE_REFRESH_TOKEN",
    valor: null,
    valor_encrypted: null,
    tipo: "SECRET",
    categoria: "INTEGRACAO",
    descricao: "Refresh token da conta Google do cliente.",
    sensivel: true,
    editavel_por_cliente: false,
    usar_padrao_sistema: false,
  },
  {
    chave: "GOOGLE_DRIVE_LAST_SYNC_AT",
    valor: "",
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "INTEGRACAO",
    descricao: "Data da ultima sincronizacao Drive.",
    sensivel: false,
    editavel_por_cliente: false,
    usar_padrao_sistema: false,
  },
  {
    chave: "GOOGLE_DRIVE_LAST_ERROR",
    valor: "",
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "INTEGRACAO",
    descricao: "Ultimo erro do Google Drive.",
    sensivel: false,
    editavel_por_cliente: false,
    usar_padrao_sistema: false,
  },
];

const memoryStore: MemoryStore = {
  clientes: [...defaultClientes],
  sistemaConfiguracoes: [],
  clienteConfiguracoes: [],
  clienteIntegracoes: [],
  clienteDriveArquivos: [],
  googleDriveOauthStates: [],
  instagramOauthStates: [],
  clienteUsuarios: [],
  parametroAuditoria: [],
  postInsightsResumo: [],
  posts: [],
  usuarios: [...defaultUsers],
  historicos: [],
  logs: [],
};

const REQUIRED_SUPABASE_TABLES = [
  "clientes",
  "cliente_usuarios",
  "cliente_integracoes",
  "posts",
  "usuarios",
  "historico_posts",
  "logs",
  "instagram_oauth_states",
  "post_insights_resumo",
] as const;
const SCHEMA_CACHE_TTL_MS = 60_000;
let supabaseSchemaCache: SupabaseSchemaState | null = null;
let usuariosRoleColumnAvailableCache: boolean | null = null;
let usuariosColumnsCache: string[] | null = null;
let aiClient: GoogleGenAI | null = null;
let aiClientKey = "";

function getGeminiClient(): GoogleGenAI {
  const apiKey = trimEnv(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nÃ£o configurada.");
  }
  if (!aiClient || aiClientKey !== apiKey) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "instaflow-manager",
        },
      },
    });
    aiClientKey = apiKey;
  }

  return aiClient;
}

function getGeminiClientWithKey(apiKey: string): GoogleGenAI {
  const normalizedApiKey = trimEnv(apiKey);
  if (!normalizedApiKey) {
    throw new Error("Chave da IA nÃ£o configurada para o cliente.");
  }
  if (!aiClient || aiClientKey !== normalizedApiKey) {
    aiClient = new GoogleGenAI({
      apiKey: normalizedApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "instaflow-manager",
        },
      },
    });
    aiClientKey = normalizedApiKey;
  }

  return aiClient;
}

function trimEnv(value?: string): string {
  return value?.trim() || "";
}

function normalizePrivateKey(value?: string): string {
  return trimEnv(value).replace(/\\n/g, "\n");
}

function hasGoogleAuthCredentials(config: RuntimeConfig): boolean {
  return Boolean(
    (config.googleClientEmail && config.googlePrivateKey) ||
      (config.googleClientId && config.googleClientSecret && config.googleRefreshToken),
  );
}

function getFallbackAiApiKey(provider: string): string {
  switch (provider.toUpperCase()) {
    case "OPENAI":
      return trimEnv(process.env.OPENAI_API_KEY);
    case "ANTHROPIC":
      return trimEnv(process.env.ANTHROPIC_API_KEY);
    case "DEEPSEEK":
      return trimEnv(process.env.DEEPSEEK_API_KEY);
    case "GROK":
      return trimEnv(process.env.GROK_API_KEY);
    case "AZURE_OPENAI":
      return trimEnv(process.env.AZURE_OPENAI_API_KEY);
    case "GEMINI":
    default:
      return trimEnv(process.env.GEMINI_API_KEY);
  }
}

function createSignedState(payload: Record<string, unknown>): string {
  const raw = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const signature = createHmac("sha256", getRuntimeConfig().mediaUrlSigningSecret).update(raw).digest("hex");
  return `${raw}.${signature}`;
}

function parseSignedState<T>(state: string): T | null {
  const [raw, signature] = String(state || "").split(".");
  if (!raw || !signature) return null;
  const expected = createHmac("sha256", getRuntimeConfig().mediaUrlSigningSecret).update(raw).digest("hex");
  if (signature !== expected) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")) as T;
  } catch {
    return null;
  }
}

function renderSimpleHtmlPage(title: string, body: string, tone: "ok" | "warn" = "warn"): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
      main { max-width: 820px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
      h1 { margin-top: 0; font-size: 24px; }
      .ok { color: #166534; }
      .warn { color: #92400e; }
      .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; }
      code, pre { font-family: Consolas, monospace; white-space: pre-wrap; word-break: break-word; }
    </style>
  </head>
  <body>
    <main>
      <h1 class="${tone}">${escapeHtml(title)}</h1>
      ${body}
    </main>
  </body>
</html>`;
}

function getSecretCipherKey(): Buffer {
  return createHash("sha256").update(getRuntimeConfig().mediaUrlSigningSecret).digest();
}

function encryptSecretValue(value: string): string {
  const raw = trimEnv(value);
  if (!raw) return "";
  if (raw.startsWith("enc:")) return raw;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecretCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecretValue(value?: string | null): string {
  const raw = trimEnv(value || "");
  if (!raw) return "";
  if (!raw.startsWith("enc:")) return raw;
  const parts = raw.slice(4).split(".");
  if (parts.length !== 3) return "";
  const [iv, tag, payload] = parts.map((item) => Buffer.from(item, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", getSecretCipherKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
}

function extractGoogleDriveFolderId(input: string): string {
  const trimmed = trimEnv(input);
  if (!trimmed) return "";
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return trimmed;
}

function normalizeAppUrl(rawUrl: string): string {
  const fallback = `http://localhost:${PORT}`;
  const source = rawUrl || fallback;

  try {
    return new URL(source).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function isLocalhostUrl(rawUrl: string): boolean {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0";
  } catch {
    return true;
  }
}

function getRuntimeConfig(): RuntimeConfig {
  const mode = trimEnv(process.env.APP_MODE).toUpperCase() === "REAL" ? "REAL" : "SIMULATOR";
  const rawAppUrl = trimEnv(process.env.APP_URL);
  const supabaseUrl = trimEnv(process.env.SUPABASE_URL);
  const supabaseAnonKey = trimEnv(process.env.SUPABASE_ANON_KEY);
  const supabaseServiceRoleKey = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const googleDriveFolderId = trimEnv(process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const defaultClientSlug = trimEnv(process.env.DEFAULT_CLIENT_SLUG) || "cliente-inicial";
  const googleClientId = trimEnv(process.env.GOOGLE_CLIENT_ID);
  const googleClientSecret = trimEnv(process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGEL_SECRET_KEY);
  const googleRefreshToken = trimEnv(process.env.GOOGLE_REFRESH_TOKEN);
  const googleRedirectUri = trimEnv(
    process.env.GOOGLE_DRIVE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
  );
  const googleClientEmail = trimEnv(process.env.GOOGLE_CLIENT_EMAIL);
  const googlePrivateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  const instagramAccessToken = trimEnv(process.env.INSTAGRAM_ACCESS_TOKEN);
  const instagramUserId = trimEnv(process.env.INSTAGRAM_USER_ID);
  const instagramBusinessId = trimEnv(process.env.INSTAGRAM_BUSINESS_ID);
  const instagramGraphBaseUrl = trimEnv(process.env.INSTAGRAM_GRAPH_BASE_URL) || "https://graph.facebook.com";
  const facebookPageId = trimEnv(process.env.FACEBOOK_PAGE_ID);
  const graphApiVersion = trimEnv(process.env.GRAPH_API_VERSION) || "v23.0";
  const metaAppId = trimEnv(process.env.META_APP_ID);
  const metaAppSecret = trimEnv(process.env.META_APP_SECRET);
  const metaRedirectUri = trimEnv(process.env.META_REDIRECT_URI);
  const instagramAppId = trimEnv(process.env.INSTAGRAM_APP_ID) || metaAppId;
  const instagramAppSecret = trimEnv(process.env.INSTAGRAM_APP_SECRET) || metaAppSecret;
  const instagramRedirectUri = trimEnv(process.env.INSTAGRAM_REDIRECT_URI);
  const metaVerifyToken = trimEnv(process.env.META_VERIFY_TOKEN);
  const appUrl = normalizeAppUrl(rawAppUrl);
  const appUrlIsPublic = Boolean(rawAppUrl) && !isLocalhostUrl(appUrl);
  const geminiModel = trimEnv(process.env.GEMINI_MODEL) || "gemini-3.5-flash";
  const mediaUrlSigningSecret = trimEnv(process.env.MEDIA_URL_SIGNING_SECRET) || "local-media-secret";

  const supabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);
  const googleAuthConfigured = Boolean(
    (googleClientEmail && googlePrivateKey) || (googleClientId && googleClientSecret && googleRefreshToken),
  );
  const googleConfigured = Boolean(googleAuthConfigured);
  const instagramConfigured = Boolean(instagramAccessToken && (instagramUserId || instagramBusinessId));
  const geminiConfigured = Boolean(trimEnv(process.env.GEMINI_API_KEY));

  const missingEnv: string[] = [];
  if (!supabaseConfigured) missingEnv.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseAnonKey) missingEnv.push("SUPABASE_ANON_KEY");
  if (!googleAuthConfigured) {
    missingEnv.push(
      "GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY ou GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN",
    );
  }
  if (!rawAppUrl) missingEnv.push("APP_URL");
  if (rawAppUrl && !appUrlIsPublic) missingEnv.push("APP_URL deve apontar para uma URL pÃºblica acessÃ­vel pela Meta");

  const operationalMode: RuntimeMode = mode === "REAL" && supabaseConfigured && appUrlIsPublic ? "REAL" : "SIMULATOR";

  return {
    appUrl,
    appUrlIsPublic,
    mode,
    operationalMode,
    graphApiVersion,
    geminiModel,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    googleClientId,
    googleClientSecret,
    googleRefreshToken,
    googleRedirectUri,
    googleClientEmail,
    googlePrivateKey,
    googleDriveFolderId,
    defaultClientSlug,
    metaAppId,
    metaAppSecret,
    metaRedirectUri,
    instagramAppId,
    instagramAppSecret,
    instagramRedirectUri,
    instagramAccessToken,
    instagramUserId,
    instagramBusinessId,
    instagramGraphBaseUrl,
    facebookPageId,
    metaVerifyToken,
    mediaUrlSigningSecret,
    supabaseConfigured,
    googleConfigured,
    instagramConfigured,
    geminiConfigured,
    missingEnv: [...new Set(missingEnv)],
  };
}

async function inspectSupabaseSchema(forceRefresh = false): Promise<SupabaseSchemaState> {
  const config = getRuntimeConfig();
  const now = Date.now();

  if (!config.supabaseConfigured) {
    return {
      ready: false,
      missingTables: [...REQUIRED_SUPABASE_TABLES],
      checkedAt: now,
    };
  }

  if (!forceRefresh && supabaseSchemaCache && now - supabaseSchemaCache.checkedAt < SCHEMA_CACHE_TTL_MS) {
    return supabaseSchemaCache;
  }

  const missingTables: string[] = [];

  try {
    for (const table of REQUIRED_SUPABASE_TABLES) {
      const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          apikey: config.supabaseServiceRoleKey,
          Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        },
      });

      if (response.ok) {
        continue;
      }

      const payload = await response.text();
      if (payload.includes("PGRST205")) {
        missingTables.push(table);
        continue;
      }

      if (payload.includes("\"code\":\"42501\"")) {
        missingTables.push(`${table} (permissão service_role ausente)`);
        continue;
      }

      if (payload.toLowerCase().includes("invalid api key")) {
        console.warn("[InstaFlow] Chave Supabase inválida. O servidor vai operar em modo local.");
        supabaseSchemaCache = {
          ready: false,
          missingTables: [...REQUIRED_SUPABASE_TABLES],
          checkedAt: now,
        };
        return supabaseSchemaCache;
      }

      throw new Error(`Falha ao validar schema do Supabase para '${table}': ${payload}`);
    }
  } catch (error) {
    const detail = maskError(error);
    console.warn(`[InstaFlow] Supabase indisponível, usando modo local: ${detail}`);
    supabaseSchemaCache = {
      ready: false,
      missingTables: [...REQUIRED_SUPABASE_TABLES],
      checkedAt: now,
    };
    return supabaseSchemaCache;
  }

  supabaseSchemaCache = {
    ready: missingTables.length === 0,
    missingTables,
    checkedAt: now,
  };

  return supabaseSchemaCache;
}

async function canUseSupabase(): Promise<boolean> {
  const config = getRuntimeConfig();
  if (!config.supabaseConfigured) {
    return false;
  }

  try {
    const schema = await inspectSupabaseSchema();
    return schema.ready;
  } catch (error) {
    console.warn(`[InstaFlow] canUseSupabase caiu para false: ${maskError(error)}`);
    return false;
  }
}

async function canUseRealMode(clienteId?: string | null): Promise<boolean> {
  const config = getRuntimeConfig();
  if (config.operationalMode !== "REAL") {
    return false;
  }
  if (!(await canUseSupabase())) {
    return false;
  }
  if (!clienteId) {
    return true;
  }
  const context = await getClienteOperationalContext(clienteId);
  return context.modoOperacao === "REAL";
}

async function hasUsuariosRoleColumn(): Promise<boolean> {
  const columns = await getUsuariosColumns();
  usuariosRoleColumnAvailableCache = columns.includes("perfil_publicacao");
  return usuariosRoleColumnAvailableCache;
}

async function getUsuariosColumns(): Promise<string[]> {
  if (usuariosColumnsCache) {
    return usuariosColumnsCache;
  }

  const config = getRuntimeConfig();
  if (!(await canUseSupabase())) {
    return [];
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      Accept: "application/openapi+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao ler metadata do schema de usuarios: ${await response.text()}`);
  }

  const openapi = (await response.json()) as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
  };

  usuariosColumnsCache = Object.keys(openapi.definitions?.usuarios?.properties || {});
  return usuariosColumnsCache;
}

function mapSupabaseUserRecord(record: Record<string, unknown>): Usuario {
  const email = String(record.email || "");
  const perfil = inferPerfilFromRawValue(record.perfil);
  const perfil_publicacao =
    inferPerfilPublicacaoFromRawValue(record.perfil_publicacao, record.perfil) ||
    (perfil === "ADMINISTRADOR" ? "ADMIN" : "CRIADOR");

  return {
    id: String(record.id || randomUUID()),
    auth_user_id: record.auth_user_id ? String(record.auth_user_id) : undefined,
    nome: String(record.nome || ""),
    email,
    perfil,
    perfil_publicacao,
    ativo: record.ativo === undefined ? String(record.status || "ATIVO").toUpperCase() !== "INATIVO" : Boolean(record.ativo),
    criado_em: String(record.criado_em || new Date().toISOString()),
  };
}

async function getSettingsView(clienteId?: string): Promise<SettingsConfig> {
  const config = getRuntimeConfig();
  const schemaState = await inspectSupabaseSchema();
  const context = await getClienteOperationalContext(clienteId || null);
  const operationalMode: RuntimeMode =
    config.mode === "REAL" && schemaState.ready && context.modoOperacao === "REAL" ? "REAL" : "SIMULATOR";

  return {
    mode: config.mode,
    operationalMode,
    appUrl: config.appUrl,
    supabaseUrl: config.supabaseUrl,
    supabaseConfigured: config.supabaseConfigured,
    supabaseSchemaReady: schemaState.ready,
    missingSupabaseTables: schemaState.missingTables,
    googleDriveFolderId: context.driveRootId,
    googleConfigured: context.googleConfigured,
    instagramBusinessId: context.instagramUserId || context.instagramBusinessId,
    instagramGraphBaseUrl: context.instagramGraphBaseUrl,
    facebookPageId: context.facebookPageId,
    instagramConfigured: context.instagramConfigured,
    geminiModel: context.aiModel,
    geminiConfigured: context.aiConfigured,
    graphApiVersion: context.graphApiVersion,
    secretsStoredInBackend: true,
    readOnly: true,
    missingEnv: config.missingEnv,
  };
}

function getPublicRuntimeConfig() {
  const config = getRuntimeConfig();

  return {
    appUrl: config.appUrl,
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    platformName: "InstaFlow",
    logos: {
      squareText: "https://i.imgur.com/JHF8X7U.png",
      squareMark: "https://i.imgur.com/wr0z5Xv.png",
      wideText: "https://i.imgur.com/gxXnYsA.png",
    },
  };
}

function normalizeStatusValue(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

async function listClientes(): Promise<Cliente[]> {
  if (!(await canUseSupabase())) {
    return [...memoryStore.clientes].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }

  try {
    return await supabaseRequest<Cliente[]>("clientes?select=*&order=criado_em.desc");
  } catch {
    return [...memoryStore.clientes].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }
}

async function getClienteById(clienteId: string): Promise<Cliente | null> {
  if (!clienteId) return null;
  if (!(await canUseSupabase())) {
    return memoryStore.clientes.find((cliente) => cliente.id === clienteId || cliente.slug === clienteId) || null;
  }

  try {
    const records = await supabaseRequest<Cliente[]>(`clientes?id=eq.${sanitizeId(clienteId)}&select=*`);
    return records[0] || null;
  } catch {
    return memoryStore.clientes.find((cliente) => cliente.id === clienteId || cliente.slug === clienteId) || null;
  }
}

async function getDefaultCliente(): Promise<Cliente> {
  const config = getRuntimeConfig();
  const bySlug = (await listClientes()).find((cliente) => cliente.slug === config.defaultClientSlug);
  if (bySlug) return bySlug;
  const first = (await listClientes())[0];
  if (first) return first;
  return memoryStore.clientes[0];
}

async function resolveClienteIdFromRequest(req: express.Request): Promise<string> {
  const requested = String(req.headers["x-client-id"] || req.query.cliente_id || "").trim();
  if (requested) {
    const client = await getClienteById(requested);
    if (client) {
      return client.id;
    }
  }

  const fallback = await getDefaultCliente();
  return fallback.id;
}

async function getClienteIntegracao(clienteId: string): Promise<ClienteIntegracao | null> {
  if (!clienteId) return null;
  if (!(await canUseSupabase())) {
    return memoryStore.clienteIntegracoes.find((item) => item.cliente_id === clienteId) || {
      id: `local-${clienteId}`,
      cliente_id: clienteId,
      modo_operacao: "SIMULADOR",
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
  }

  try {
    const records = await supabaseRequest<ClienteIntegracao[]>(
      `cliente_integracoes?cliente_id=eq.${sanitizeId(clienteId)}&select=*`,
    );
    return records[0] || null;
  } catch {
    return null;
  }
}

function maskSecretValue(value?: string | null): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function stringifyConfigValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function listSistemaConfiguracoes(): Promise<SistemaConfiguracao[]> {
  const config = getRuntimeConfig();
  const runtimeItems: SistemaConfiguracao[] = [
    {
      id: "runtime-app-url",
      chave: "APP_URL",
      valor: config.appUrl,
      tipo: "STRING",
      categoria: "GERAL",
      descricao: "URL publica da aplicacao.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-supabase-url",
      chave: "SUPABASE_URL",
      valor: config.supabaseUrl,
      tipo: "STRING",
      categoria: "BANCO",
      descricao: "URL do projeto Supabase.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-supabase-anon",
      chave: "SUPABASE_ANON_KEY",
      valor_encrypted: config.supabaseAnonKey,
      tipo: "SECRET",
      categoria: "BANCO",
      descricao: "Chave publica do Supabase.",
      sensivel: true,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-default-client",
      chave: "DEFAULT_CLIENT_SLUG",
      valor: config.defaultClientSlug,
      tipo: "STRING",
      categoria: "CLIENTES",
      descricao: "Slug padrao carregado apos autenticacao.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-graph-api-version",
      chave: "GRAPH_API_VERSION",
      valor: config.graphApiVersion,
      tipo: "STRING",
      categoria: "META",
      descricao: "Versao global da Graph API.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-instagram-graph-base-url",
      chave: "INSTAGRAM_GRAPH_BASE_URL",
      valor: config.instagramGraphBaseUrl,
      tipo: "STRING",
      categoria: "META",
      descricao: "Base global da Graph API.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-google-client-id",
      chave: "GOOGLE_CLIENT_ID",
      valor: config.googleClientId,
      tipo: "STRING",
      categoria: "GOOGLE",
      descricao: "Client ID global do Google OAuth.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-google-redirect-uri",
      chave: "GOOGLE_REDIRECT_URI",
      valor: config.googleRedirectUri,
      tipo: "STRING",
      categoria: "GOOGLE",
      descricao: "Redirect URI global do Google OAuth.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-google-client-email",
      chave: "GOOGLE_CLIENT_EMAIL",
      valor: config.googleClientEmail,
      tipo: "STRING",
      categoria: "GOOGLE",
      descricao: "Conta de servico global do Google Drive.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-meta-app-id",
      chave: "META_APP_ID",
      valor: config.metaAppId,
      tipo: "STRING",
      categoria: "META",
      descricao: "App ID global da Meta.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-meta-redirect-uri",
      chave: "META_REDIRECT_URI",
      valor: config.metaRedirectUri,
      tipo: "STRING",
      categoria: "META",
      descricao: "Redirect URI global da Meta.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-meta-verify-token",
      chave: "META_VERIFY_TOKEN",
      valor_encrypted: config.metaVerifyToken,
      tipo: "SECRET",
      categoria: "META",
      descricao: "Token de validacao global do webhook da Meta.",
      sensivel: true,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-ai-default-provider",
      chave: "AI_DEFAULT_PROVIDER",
      valor: trimEnv(process.env.AI_DEFAULT_PROVIDER) || "GEMINI",
      tipo: "STRING",
      categoria: "IA",
      descricao: "Provedor padrao do sistema.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-ai-default-model",
      chave: "AI_DEFAULT_MODEL",
      valor: trimEnv(process.env.AI_DEFAULT_MODEL) || config.geminiModel,
      tipo: "STRING",
      categoria: "IA",
      descricao: "Modelo padrao do sistema.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-ai-provider-options",
      chave: "AI_PROVIDER_OPTIONS",
      valor: trimEnv(process.env.AI_PROVIDER_OPTIONS),
      tipo: "STRING",
      categoria: "IA",
      descricao: "Lista de provedores habilitados no sistema.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: "runtime-client-storage",
      chave: "CLIENT_INTEGRATIONS_STORAGE",
      valor: trimEnv(process.env.CLIENT_INTEGRATIONS_STORAGE) || "SUPABASE",
      tipo: "STRING",
      categoria: "SEGURANCA",
      descricao: "Origem padrao das credenciais de cliente.",
      sensivel: false,
      editavel: false,
      criado_em: new Date(0).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
  ];

  const stored = !(await canUseSupabase())
    ? [...memoryStore.sistemaConfiguracoes]
    : await supabaseRequest<SistemaConfiguracao[]>("sistema_configuracoes?select=*&order=categoria.asc,chave.asc").catch(
        () => [...memoryStore.sistemaConfiguracoes],
      );

  const merged = new Map<string, SistemaConfiguracao>(stored.map((item) => [item.chave, item]));
  for (const item of runtimeItems) {
    const existing = merged.get(item.chave);
    merged.set(item.chave, {
      ...existing,
      ...item,
      id: existing?.id || item.id,
      criado_em: existing?.criado_em || item.criado_em,
      atualizado_em: item.atualizado_em,
    });
  }

  return Array.from(merged.values()).sort((left, right) =>
    `${left.categoria}:${left.chave}`.localeCompare(`${right.categoria}:${right.chave}`),
  );
}

async function listClienteConfiguracoes(clienteId: string): Promise<ClienteConfiguracao[]> {
  if (!(await canUseSupabase())) {
    return memoryStore.clienteConfiguracoes.filter((item) => item.cliente_id === clienteId);
  }

  try {
    return await supabaseRequest<ClienteConfiguracao[]>(
      `cliente_configuracoes?cliente_id=eq.${sanitizeId(clienteId)}&select=*&order=categoria.asc,chave.asc`,
    );
  } catch {
    return memoryStore.clienteConfiguracoes.filter((item) => item.cliente_id === clienteId);
  }
}

async function listParametroAuditoria(clienteId?: string): Promise<ParametroAuditoria[]> {
  if (!(await canUseSupabase())) {
    return clienteId
      ? memoryStore.parametroAuditoria.filter((item) => item.cliente_id === clienteId)
      : [...memoryStore.parametroAuditoria];
  }

  try {
    const query = clienteId
      ? `parametro_auditoria?cliente_id=eq.${sanitizeId(clienteId)}&select=*&order=criado_em.desc`
      : "parametro_auditoria?select=*&order=criado_em.desc";
    return await supabaseRequest<ParametroAuditoria[]>(query);
  } catch {
    return clienteId
      ? memoryStore.parametroAuditoria.filter((item) => item.cliente_id === clienteId)
      : [...memoryStore.parametroAuditoria];
  }
}

async function createParametroAuditoria(payload: Omit<ParametroAuditoria, "id" | "criado_em">): Promise<void> {
  const record: ParametroAuditoria = {
    id: randomUUID(),
    criado_em: new Date().toISOString(),
    ...payload,
  };

  if (!(await canUseSupabase())) {
    memoryStore.parametroAuditoria.unshift(record);
    return;
  }

  try {
    await supabaseRequest<ParametroAuditoria[]>("parametro_auditoria", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(record),
    });
  } catch {
    memoryStore.parametroAuditoria.unshift(record);
  }
}

async function listClienteIntegracoes(): Promise<ClienteIntegracao[]> {
  if (!(await canUseSupabase())) {
    return [...memoryStore.clienteIntegracoes];
  }
  try {
    return await supabaseRequest<ClienteIntegracao[]>("cliente_integracoes?select=*");
  } catch {
    return [...memoryStore.clienteIntegracoes];
  }
}

async function findClienteIntegracaoByInstagramIdentity(identity: string): Promise<ClienteIntegracao | null> {
  const normalized = trimEnv(identity);
  if (!normalized) return null;
  const all = await listClienteIntegracoes();
  return (
    all.find(
      (item) =>
        item.instagram_user_id === normalized ||
        item.instagram_business_id === normalized ||
        item.instagram_username === normalized,
    ) || null
  );
}

async function handleInstagramDeauthorizeRequest(body: Record<string, unknown>) {
  const clienteId = trimEnv(String(body?.clienteId || body?.cliente_id || ""));
  const instagramIdentity = trimEnv(
    String(body?.instagram_user_id || body?.user_id || body?.instagram_business_id || body?.instagram_username || ""),
  );
  const integracao = clienteId
    ? await getClienteIntegracao(clienteId)
    : await findClienteIntegracaoByInstagramIdentity(instagramIdentity);

  if (integracao?.cliente_id) {
    await setClienteInstagramStatus(integracao.cliente_id, "DESCONECTADO", {
      instagram_access_token_encrypted: null,
      instagram_username: integracao.instagram_username || null,
      instagram_user_id: integracao.instagram_user_id || null,
      instagram_business_id: integracao.instagram_business_id || null,
      instagram_media_actor_id: null,
      facebook_page_id: integracao.facebook_page_id || null,
      instagram_token_expires_at: null,
    });
  }

  await addLog(
    "Instagram API",
    "warn",
    "Recebida solicitaÃ§Ã£o de desautorizaÃ§Ã£o do Instagram.",
    {
      body,
      clienteId: integracao?.cliente_id || clienteId || null,
      instagramIdentity: instagramIdentity || null,
    },
    integracao?.cliente_id || clienteId || undefined,
  );
}

async function handleInstagramDataDeletionRequest(body: Record<string, unknown>) {
  const confirmationCode = randomBytes(12).toString("hex");
  await addLog("Instagram API", "warn", "Recebida solicitaÃ§Ã£o de exclusÃ£o de dados da Meta.", {
    body,
    confirmationCode,
  });
  return {
    url: `${getRuntimeConfig().appUrl}/instagram/data-deletion-status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  };
}

async function createGoogleDriveOauthState(
  payload: Omit<GoogleDriveOauthState, "id" | "criado_em">,
): Promise<GoogleDriveOauthState> {
  const record: GoogleDriveOauthState = {
    id: randomUUID(),
    criado_em: new Date().toISOString(),
    ...payload,
  };

  if (!(await canUseSupabase())) {
    memoryStore.googleDriveOauthStates.unshift(record);
    return record;
  }

  try {
    const created = await supabaseRequest<GoogleDriveOauthState[]>("google_drive_oauth_states", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(record),
    });
    return created[0] || record;
  } catch {
    memoryStore.googleDriveOauthStates.unshift(record);
    return record;
  }
}

async function getGoogleDriveOauthState(stateValue: string): Promise<GoogleDriveOauthState | null> {
  if (!(await canUseSupabase())) {
    return memoryStore.googleDriveOauthStates.find((item) => item.state === stateValue) || null;
  }

  try {
    const items = await supabaseRequest<GoogleDriveOauthState[]>(
      `google_drive_oauth_states?state=eq.${sanitizeId(stateValue)}&select=*`,
    );
    return items[0] || memoryStore.googleDriveOauthStates.find((item) => item.state === stateValue) || null;
  } catch {
    return memoryStore.googleDriveOauthStates.find((item) => item.state === stateValue) || null;
  }
}

async function markGoogleDriveOauthStateUsed(stateId: string, stateValue: string): Promise<void> {
  const usedAt = new Date().toISOString();
  const memoryItem = memoryStore.googleDriveOauthStates.find((item) => item.id === stateId || item.state === stateValue);
  if (memoryItem) {
    memoryItem.used_at = usedAt;
  }

  if (!(await canUseSupabase())) {
    return;
  }

  try {
    await supabaseRequest<GoogleDriveOauthState[]>(
      `google_drive_oauth_states?id=eq.${sanitizeId(stateId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ used_at: usedAt }),
      },
    );
  } catch {
    // fall back to memory only
  }
}

async function upsertClienteDriveArquivo(
  payload: Omit<ClienteDriveArquivo, "id" | "criado_em" | "atualizado_em"> & { id?: string },
): Promise<ClienteDriveArquivo> {
  const now = new Date().toISOString();
  const record: ClienteDriveArquivo = {
    id: payload.id || randomUUID(),
    criado_em: now,
    atualizado_em: now,
    ...payload,
  };

  if (!(await canUseSupabase())) {
    const index = memoryStore.clienteDriveArquivos.findIndex((item) => item.drive_file_id === record.drive_file_id);
    if (index >= 0) {
      memoryStore.clienteDriveArquivos[index] = { ...memoryStore.clienteDriveArquivos[index], ...record, atualizado_em: now };
      return memoryStore.clienteDriveArquivos[index];
    }
    memoryStore.clienteDriveArquivos.unshift(record);
    return record;
  }

  try {
    const created = await supabaseRequest<ClienteDriveArquivo[]>("cliente_drive_arquivos", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(record),
    });
    return created[0] || record;
  } catch {
    const index = memoryStore.clienteDriveArquivos.findIndex((item) => item.drive_file_id === record.drive_file_id);
    if (index >= 0) {
      memoryStore.clienteDriveArquivos[index] = { ...memoryStore.clienteDriveArquivos[index], ...record, atualizado_em: now };
      return memoryStore.clienteDriveArquivos[index];
    }
    memoryStore.clienteDriveArquivos.unshift(record);
    return record;
  }
}

async function createInstagramOauthState(
  payload: Omit<InstagramOauthState, "id" | "criado_em"> & { id?: string },
): Promise<InstagramOauthState> {
  const record: InstagramOauthState = {
    id: payload.id || randomUUID(),
    criado_em: new Date().toISOString(),
    ...payload,
  };

  if (!(await canUseSupabase())) {
    memoryStore.instagramOauthStates.unshift(record);
    return record;
  }

  try {
    const created = await supabaseRequest<InstagramOauthState[]>("instagram_oauth_states", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(record),
    });
    return created[0] || record;
  } catch {
    memoryStore.instagramOauthStates.unshift(record);
    return record;
  }
}

async function getInstagramOauthState(stateValue: string): Promise<InstagramOauthState | null> {
  if (!(await canUseSupabase())) {
    return memoryStore.instagramOauthStates.find((item) => item.state === stateValue) || null;
  }
  try {
    const items = await supabaseRequest<InstagramOauthState[]>(
      `instagram_oauth_states?state=eq.${sanitizeId(stateValue)}&select=*`,
    );
    return items[0] || memoryStore.instagramOauthStates.find((item) => item.state === stateValue) || null;
  } catch {
    return memoryStore.instagramOauthStates.find((item) => item.state === stateValue) || null;
  }
}

async function markInstagramOauthStateUsed(stateId: string, stateValue: string): Promise<void> {
  const usedAt = new Date().toISOString();
  const memoryItem = memoryStore.instagramOauthStates.find((item) => item.id === stateId || item.state === stateValue);
  if (memoryItem) memoryItem.used_at = usedAt;
  if (!(await canUseSupabase())) {
    return;
  }
  try {
    await supabaseRequest<InstagramOauthState[]>(
      `instagram_oauth_states?id=eq.${sanitizeId(stateId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ used_at: usedAt }),
      },
    );
  } catch {
    // keep memory state
  }
}

async function upsertSistemaConfiguracao(item: Partial<SistemaConfiguracao> & { chave: string }): Promise<SistemaConfiguracao> {
  const now = new Date().toISOString();
  const existing = (await listSistemaConfiguracoes()).find((config) => config.chave === item.chave);
  const payload: SistemaConfiguracao = {
    id: existing?.id || randomUUID(),
    chave: item.chave,
    valor: item.valor ?? existing?.valor ?? null,
    valor_encrypted: item.valor_encrypted ?? existing?.valor_encrypted ?? null,
    tipo: item.tipo || existing?.tipo || "STRING",
    categoria: item.categoria || existing?.categoria || "GERAL",
    descricao: item.descricao ?? existing?.descricao ?? null,
    sensivel: item.sensivel ?? existing?.sensivel ?? false,
    editavel: item.editavel ?? existing?.editavel ?? true,
    criado_em: existing?.criado_em || now,
    atualizado_em: now,
  };

  if (!(await canUseSupabase())) {
    const index = memoryStore.sistemaConfiguracoes.findIndex((config) => config.chave === item.chave);
    if (index >= 0) {
      memoryStore.sistemaConfiguracoes[index] = payload;
    } else {
      memoryStore.sistemaConfiguracoes.unshift(payload);
    }
    return payload;
  }

  const method = existing ? "PATCH" : "POST";
  const endpoint = existing ? `sistema_configuracoes?chave=eq.${sanitizeId(item.chave)}` : "sistema_configuracoes";
  const result = await supabaseRequest<SistemaConfiguracao[]>(endpoint, {
    method,
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return result[0] || payload;
}

async function upsertClienteConfiguracao(
  clienteId: string,
  item: Partial<ClienteConfiguracao> & { chave: string },
): Promise<ClienteConfiguracao> {
  const now = new Date().toISOString();
  const existing = (await listClienteConfiguracoes(clienteId)).find((config) => config.chave === item.chave);
  const payload: ClienteConfiguracao = {
    id: existing?.id || randomUUID(),
    cliente_id: clienteId,
    chave: item.chave,
    valor: item.valor ?? existing?.valor ?? null,
    valor_encrypted: item.valor_encrypted ?? existing?.valor_encrypted ?? null,
    tipo: item.tipo || existing?.tipo || "STRING",
    categoria: item.categoria || existing?.categoria || "GERAL",
    descricao: item.descricao ?? existing?.descricao ?? null,
    sensivel: item.sensivel ?? existing?.sensivel ?? false,
    editavel_por_cliente: item.editavel_por_cliente ?? existing?.editavel_por_cliente ?? false,
    usar_padrao_sistema: item.usar_padrao_sistema ?? existing?.usar_padrao_sistema ?? false,
    criado_em: existing?.criado_em || now,
    atualizado_em: now,
  };

  if (!(await canUseSupabase())) {
    const index = memoryStore.clienteConfiguracoes.findIndex(
      (config) => config.cliente_id === clienteId && config.chave === item.chave,
    );
    if (index >= 0) {
      memoryStore.clienteConfiguracoes[index] = payload;
    } else {
      memoryStore.clienteConfiguracoes.unshift(payload);
    }
    return payload;
  }

  const method = existing ? "PATCH" : "POST";
  const endpoint = existing
    ? `cliente_configuracoes?cliente_id=eq.${sanitizeId(clienteId)}&chave=eq.${sanitizeId(item.chave)}`
    : "cliente_configuracoes";
  const result = await supabaseRequest<ClienteConfiguracao[]>(endpoint, {
    method,
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return result[0] || payload;
}

async function ensureClienteSetup(clienteId: string): Promise<void> {
  if (!clienteId) return;

  const integracaoAtual = await getClienteIntegracao(clienteId);
  if (!integracaoAtual) {
    const now = new Date().toISOString();
    const payload: ClienteIntegracao = {
      id: randomUUID(),
      cliente_id: clienteId,
      google_drive_folder_id: null,
      google_drive_entrada_folder_id: null,
      google_drive_aprovacao_folder_id: null,
      google_drive_aprovados_folder_id: null,
      google_drive_imagens_folder_id: null,
      google_drive_videos_folder_id: null,
      google_drive_publicados_folder_id: null,
      google_drive_rejeitados_folder_id: null,
      google_drive_arquivados_folder_id: null,
      google_account_email: null,
      google_drive_refresh_token_encrypted: null,
      google_drive_token_expires_at: null,
      google_drive_status: "NAO_CONECTADO",
      google_drive_last_sync_at: null,
      google_drive_last_error: null,
      instagram_username: null,
      instagram_access_token: null,
      instagram_access_token_encrypted: null,
      instagram_token_status: "NAO_CONFIGURADO",
      instagram_token_expires_at: null,
      instagram_connected_at: null,
      instagram_last_sync_at: null,
      instagram_connection_mode: "INSTAGRAM_LOGIN",
      instagram_webhook_enabled: false,
      instagram_user_id: null,
      instagram_business_id: null,
      instagram_media_actor_id: null,
      facebook_page_id: null,
      graph_api_version: getRuntimeConfig().graphApiVersion,
      modo_operacao: "SIMULADOR",
      criado_em: now,
      atualizado_em: now,
    };

    if (!(await canUseSupabase())) {
      memoryStore.clienteIntegracoes.unshift(payload);
    } else {
      await supabaseRequest<ClienteIntegracao[]>("cliente_integracoes", {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    }
  }

  for (const item of CLIENTE_CONFIG_DEFAULTS) {
    await upsertClienteConfiguracao(clienteId, item);
  }
}

async function resolveConfigValue(clienteId: string | null, chave: string): Promise<string> {
  if (clienteId) {
    const clienteConfigs = await listClienteConfiguracoes(clienteId);
    const clienteConfig = clienteConfigs.find((config) => config.chave === chave);
    if (clienteConfig && !clienteConfig.usar_padrao_sistema) {
      return clienteConfig.valor_encrypted || clienteConfig.valor || "";
    }
  }

  const sistemaConfigs = await listSistemaConfiguracoes();
  const sistemaConfig = sistemaConfigs.find((config) => config.chave === chave);
  return sistemaConfig?.valor_encrypted || sistemaConfig?.valor || "";
}

async function resolveSecretConfigValue(clienteId: string | null, chave: string): Promise<string> {
  return decryptSecretValue(await resolveConfigValue(clienteId, chave));
}

async function getClienteOperationalContext(clienteId?: string | null): Promise<ClienteOperationalContext> {
  const runtime = getRuntimeConfig();
  const integrations = clienteId ? await getClienteIntegracao(clienteId) : null;
  const aiProvider =
    (await resolveConfigValue(clienteId || null, "PROVEDOR_IA")) ||
    trimEnv(process.env.AI_DEFAULT_PROVIDER) ||
    "GEMINI";
  const aiModel =
    (await resolveConfigValue(clienteId || null, "MODELO_IA")) ||
    trimEnv(process.env.AI_DEFAULT_MODEL) ||
    runtime.geminiModel;
  const aiApiKey = (await resolveConfigValue(clienteId || null, "IA_API_KEY")) || getFallbackAiApiKey(aiProvider);
  const googleRefreshToken =
    (await resolveSecretConfigValue(clienteId || null, "GOOGLE_REFRESH_TOKEN")) || runtime.googleRefreshToken;
  const configuredOperationMode = ((await resolveConfigValue(clienteId || null, "MODO_OPERACAO")) || "").toUpperCase();
  const googleDriveStatus =
    (await resolveConfigValue(clienteId || null, "GOOGLE_DRIVE_STATUS")) ||
    integrations?.google_drive_status ||
    "NAO_CONECTADO";
  const googleAccountEmail =
    (await resolveConfigValue(clienteId || null, "GOOGLE_OAUTH_ACCOUNT_EMAIL")) ||
    integrations?.google_account_email ||
    "";
  const driveRootId =
    integrations?.google_drive_folder_id ||
    trimEnv(process.env.GOOGLE_DRIVE_FOLDER_ID) ||
    trimEnv(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const driveEntradaId =
    integrations?.google_drive_entrada_folder_id ||
    integrations?.google_drive_imagens_folder_id ||
    trimEnv(process.env.GOOGLE_DRIVE_IMAGES_FOLDER_ID);
  const driveAprovacaoId = integrations?.google_drive_aprovacao_folder_id || "";
  const driveAprovadosId = integrations?.google_drive_aprovados_folder_id || "";
  const drivePublishedId =
    integrations?.google_drive_publicados_folder_id || trimEnv(process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID);
  const driveRejeitadosId = integrations?.google_drive_rejeitados_folder_id || "";
  const driveArquivadosId = integrations?.google_drive_arquivados_folder_id || "";
  const instagramAccessToken =
    decryptSecretValue(integrations?.instagram_access_token_encrypted) ||
    integrations?.instagram_access_token ||
    (!clienteId ? runtime.instagramAccessToken : "");
  const instagramUsername = integrations?.instagram_username || "";
  const instagramUserId = integrations?.instagram_user_id || (!clienteId ? runtime.instagramUserId : "");
  const instagramBusinessId = integrations?.instagram_business_id || (!clienteId ? runtime.instagramBusinessId : "");
  const instagramConnectionMode = integrations?.instagram_connection_mode || "INSTAGRAM_LOGIN";
  const instagramTokenStatus = integrations?.instagram_token_status || (instagramAccessToken ? "ATIVO" : "NAO_CONFIGURADO");
  const instagramTokenExpiresAt = integrations?.instagram_token_expires_at || "";
  const graphApiVersion = integrations?.graph_api_version || runtime.graphApiVersion;
  const googleConfigured = Boolean(
    driveRootId &&
      ((runtime.googleClientEmail && runtime.googlePrivateKey) ||
        (runtime.googleClientId && runtime.googleClientSecret && googleRefreshToken)),
  );
  const instagramConfigured = Boolean(instagramAccessToken && (instagramUserId || instagramBusinessId));
  const modoOperacao =
    runtime.mode === "REAL" &&
    runtime.appUrlIsPublic &&
    (integrations?.modo_operacao === "REAL" || configuredOperationMode === "REAL") &&
    instagramConfigured
      ? "REAL"
      : "SIMULATOR";

  return {
    clienteId: clienteId || null,
    driveRootId,
    driveEntradaId,
    driveAprovacaoId,
    driveAprovadosId,
    drivePublishedId,
    driveRejeitadosId,
    driveArquivadosId,
    googleRefreshToken,
    googleDriveStatus,
    googleAccountEmail,
    graphApiVersion,
    instagramUsername,
    instagramAccessToken,
    instagramTokenExpiresAt,
    instagramUserId,
    instagramBusinessId,
    instagramConnectionMode,
    instagramTokenStatus,
    facebookPageId: integrations?.facebook_page_id || runtime.facebookPageId,
    instagramGraphBaseUrl: runtime.instagramGraphBaseUrl,
    googleConfigured,
    instagramConfigured,
    aiProvider: aiProvider.toUpperCase(),
    aiModel,
    aiApiKey,
    aiConfigured: Boolean(aiApiKey),
    modoOperacao,
  };
}

async function updateClienteIntegracaoRecord(
  clienteId: string,
  patch: Partial<ClienteIntegracao>,
): Promise<ClienteIntegracao | null> {
  const current = await getClienteIntegracao(clienteId);
  const now = new Date().toISOString();
  const payload: ClienteIntegracao = {
    id: current?.id || randomUUID(),
    criado_em: current?.criado_em || now,
    modo_operacao: current?.modo_operacao || "SIMULADOR",
    graph_api_version: current?.graph_api_version || getRuntimeConfig().graphApiVersion,
    ...current,
    ...patch,
    cliente_id: clienteId,
    atualizado_em: now,
  };

  if (!(await canUseSupabase())) {
    const index = memoryStore.clienteIntegracoes.findIndex((item) => item.cliente_id === clienteId);
    if (index >= 0) {
      memoryStore.clienteIntegracoes[index] = payload;
    } else {
      memoryStore.clienteIntegracoes.unshift(payload);
    }
    return payload;
  }

  const existing = await supabaseRequest<ClienteIntegracao[]>(
    `cliente_integracoes?cliente_id=eq.${sanitizeId(clienteId)}&select=*`,
  ).catch(() => []);
  const result = existing.length
    ? await supabaseRequest<ClienteIntegracao[]>(
        `cliente_integracoes?cliente_id=eq.${sanitizeId(clienteId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        },
      )
    : await supabaseRequest<ClienteIntegracao[]>("cliente_integracoes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });

  return result[0] || payload;
}

function sanitizeClienteIntegracaoForResponse(integracao: ClienteIntegracao | null): ClienteIntegracao | null {
  if (!integracao) return null;
  const maskedToken = integracao.instagram_access_token_encrypted
    ? "IG...****"
    : integracao.instagram_access_token
      ? "IG...****"
      : null;
  return {
    ...integracao,
    instagram_access_token: maskedToken,
    instagram_access_token_encrypted: integracao.instagram_access_token_encrypted ? "ENCRYPTED" : null,
    google_drive_access_token_encrypted: integracao.google_drive_access_token_encrypted ? "ENCRYPTED" : null,
    google_drive_refresh_token_encrypted: integracao.google_drive_refresh_token_encrypted ? "ENCRYPTED" : null,
  };
}

async function setClienteInstagramStatus(
  clienteId: string,
  status: NonNullable<ClienteIntegracao["instagram_token_status"]>,
  patch?: Partial<ClienteIntegracao>,
): Promise<ClienteIntegracao | null> {
  return updateClienteIntegracaoRecord(clienteId, {
    instagram_token_status: status,
    instagram_last_sync_at:
      patch?.instagram_last_sync_at === undefined ? new Date().toISOString() : patch.instagram_last_sync_at,
    ...patch,
  });
}

async function setClienteGoogleDriveStatus(
  clienteId: string,
  status: NonNullable<ClienteIntegracao["google_drive_status"]>,
  extra?: { accountEmail?: string; lastError?: string; connectedAt?: string; token?: string },
): Promise<void> {
  await upsertClienteConfiguracao(clienteId, {
    chave: "GOOGLE_DRIVE_STATUS",
    valor: status,
    valor_encrypted: null,
    tipo: "STRING",
    categoria: "INTEGRACAO",
    descricao: "Status operacional do Google Drive do cliente.",
    sensivel: false,
    editavel_por_cliente: false,
    usar_padrao_sistema: false,
  });
  if (extra?.accountEmail !== undefined) {
    await upsertClienteConfiguracao(clienteId, {
      chave: "GOOGLE_OAUTH_ACCOUNT_EMAIL",
      valor: extra.accountEmail || "",
      valor_encrypted: null,
      tipo: "STRING",
      categoria: "INTEGRACAO",
      descricao: "Conta Google conectada ao cliente.",
      sensivel: false,
      editavel_por_cliente: false,
      usar_padrao_sistema: false,
    });
  }
  if (extra?.connectedAt !== undefined) {
    await upsertClienteConfiguracao(clienteId, {
      chave: "GOOGLE_OAUTH_CONNECTED_AT",
      valor: extra.connectedAt || "",
      valor_encrypted: null,
      tipo: "STRING",
      categoria: "INTEGRACAO",
      descricao: "Data da ultima conexao Google.",
      sensivel: false,
      editavel_por_cliente: false,
      usar_padrao_sistema: false,
    });
  }
  if (extra?.lastError !== undefined) {
    await upsertClienteConfiguracao(clienteId, {
      chave: "GOOGLE_DRIVE_LAST_ERROR",
      valor: extra.lastError || "",
      valor_encrypted: null,
      tipo: "STRING",
      categoria: "INTEGRACAO",
      descricao: "Ultimo erro do Google Drive.",
      sensivel: false,
      editavel_por_cliente: false,
      usar_padrao_sistema: false,
    });
  }
  if (extra?.token !== undefined) {
    await upsertClienteConfiguracao(clienteId, {
      chave: "GOOGLE_REFRESH_TOKEN",
      valor: null,
      valor_encrypted: extra.token ? encryptSecretValue(extra.token) : null,
      tipo: "SECRET",
      categoria: "INTEGRACAO",
      descricao: "Refresh token da conta Google do cliente.",
      sensivel: true,
      editavel_por_cliente: false,
      usar_padrao_sistema: false,
    });
  }

  await updateClienteIntegracaoRecord(clienteId, {
    google_drive_status: status,
    google_account_email: extra?.accountEmail,
    google_drive_refresh_token_encrypted: extra?.token ? encryptSecretValue(extra.token) : undefined,
    google_drive_last_error: extra?.lastError,
    google_drive_last_sync_at: extra?.connectedAt,
  });
}

function toJsonString(payload?: unknown): string | undefined {
  if (payload === undefined) return undefined;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function maskError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function assertPostMediaValidation(
  payload: unknown,
  post: Post,
): { resolvedTipo: Post["tipo"]; width: number; height: number; aspectRatio: number; durationSeconds?: number } {
  if (!post.drive_url) {
    throw new HttpError(400, "A postagem precisa ter uma mÃ­dia pÃºblica vinculada antes da publicaÃ§Ã£o.");
  }

  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "A validaÃ§Ã£o da mÃ­dia Ã© obrigatÃ³ria antes de agendar ou publicar.");
  }

  const candidate = payload as {
    width?: unknown;
    height?: unknown;
    aspectRatio?: unknown;
    isFeedCompatible?: unknown;
    mediaKind?: unknown;
    durationSeconds?: unknown;
  };

  const width = typeof candidate.width === "number" ? candidate.width : Number(candidate.width);
  const height = typeof candidate.height === "number" ? candidate.height : Number(candidate.height);
  const aspectRatio = typeof candidate.aspectRatio === "number" ? candidate.aspectRatio : Number(candidate.aspectRatio);
  const isFeedCompatible = candidate.isFeedCompatible === true;
  const durationSeconds =
    candidate.durationSeconds === undefined || candidate.durationSeconds === null
      ? undefined
      : typeof candidate.durationSeconds === "number"
        ? candidate.durationSeconds
        : Number(candidate.durationSeconds);
  const resolvedTipo =
    candidate.mediaKind === "video"
      ? "VIDEO"
      : candidate.mediaKind === "image"
        ? "IMAGEM"
        : post.tipo;

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(aspectRatio)) {
    throw new HttpError(400, "A validaÃ§Ã£o da mÃ­dia retornou dimensÃµes invÃ¡lidas.");
  }

  if (!isFeedCompatible) {
    throw new HttpError(400, "A mÃ­dia nÃ£o passou na validaÃ§Ã£o para o feed do Instagram.");
  }

  if (resolvedTipo === "VIDEO" || resolvedTipo === "REELS") {
    if (!Number.isFinite(durationSeconds) || Number(durationSeconds) <= 0) {
      throw new HttpError(400, "NÃƒÂ£o foi possÃƒÂ­vel validar a duraÃƒÂ§ÃƒÂ£o do vÃƒÂ­deo.");
    }
    if (Number(durationSeconds) > 180) {
      throw new HttpError(
        400,
        "O vÃƒÂ­deo excede o limite atual de 3 minutos adotado para publicaÃƒÂ§ÃƒÂ£o em Reels no Instagram.",
      );
    }
  }

  if (resolvedTipo === "REELS") {
    if (aspectRatio < 0.56 || aspectRatio > 0.8) {
      throw new HttpError(400, "Reels devem estar entre 9:16 e 4:5 para publicaÃ§Ã£o consistente.");
    }
    return { resolvedTipo, width, height, aspectRatio, durationSeconds };
  }

  if (resolvedTipo === "VIDEO") {
    if (aspectRatio < 0.56 || aspectRatio > 1.91) {
      throw new HttpError(400, "VÃ­deos devem usar proporÃ§Ã£o entre 9:16 e 1.91:1.");
    }
    return { resolvedTipo, width, height, aspectRatio, durationSeconds };
  }

  if (aspectRatio < 0.8 || aspectRatio > 1.91) {
    throw new HttpError(400, "Posts de feed devem usar proporÃ§Ã£o entre 4:5 e 1.91:1.");
  }

  return { resolvedTipo, width, height, aspectRatio, durationSeconds };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePerfilPublicacao(user: Partial<Usuario>): PerfilPublicacao {
  if (
    user.perfil_publicacao === "CRIADOR" ||
    user.perfil_publicacao === "APROVADOR" ||
    user.perfil_publicacao === "ADMIN" ||
    user.perfil_publicacao === "ADMIN_CLIENTE" ||
    user.perfil_publicacao === "SUPER_ADMIN" ||
    user.perfil_publicacao === "VISUALIZADOR"
  ) {
    return user.perfil_publicacao;
  }

  if (user.perfil === "ADMINISTRADOR") {
    return "ADMIN";
  }

  return "CRIADOR";
}

function toActingUser(user: Usuario): ActingUser {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    perfil_publicacao: normalizePerfilPublicacao(user),
    ativo: user.ativo,
  };
}

function inferPerfilFromRawValue(value: unknown): Usuario["perfil"] {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "ADMIN" || normalized === "ADMINISTRADOR") {
    return "ADMINISTRADOR";
  }
  return "USUARIO";
}

function inferPerfilPublicacaoFromRawValue(value: unknown, fallbackPerfil?: unknown): PerfilPublicacao {
  const normalized = String(value || fallbackPerfil || "").toUpperCase();
  if (normalized === "ADMIN" || normalized === "ADMINISTRADOR") {
    return "ADMIN";
  }
  if (normalized === "SUPER_ADMIN") {
    return "SUPER_ADMIN";
  }
  if (normalized === "ADMIN_CLIENTE") {
    return "ADMIN_CLIENTE";
  }
  if (normalized === "APROVADOR") {
    return "APROVADOR";
  }
  if (normalized === "VISUALIZADOR") {
    return "VISUALIZADOR";
  }
  return "CRIADOR";
}

function sanitizeId(value: string): string {
  return encodeURIComponent(value);
}

async function safeParseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return [] as T;
  }
  return JSON.parse(text) as T;
}

async function supabaseRequest<T>(resource: string, init?: RequestInit): Promise<T> {
  const config = getRuntimeConfig();

  if (!(await canUseSupabase())) {
    throw new Error("Supabase nÃ£o configurado.");
  }

  const headers = new Headers(init?.headers);
  headers.set("apikey", config.supabaseServiceRoleKey);
  headers.set("Authorization", `Bearer ${config.supabaseServiceRoleKey}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${resource}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase ${response.status}: ${message}`);
  }

  return safeParseJson<T>(response);
}

async function listPosts(clienteId?: string): Promise<Post[]> {
  if (!(await canUseSupabase())) {
    const items = clienteId ? memoryStore.posts.filter((post) => post.cliente_id === clienteId) : memoryStore.posts;
    return [...items].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }

  const query = clienteId ? `posts?select=*&cliente_id=eq.${sanitizeId(clienteId)}&order=criado_em.desc` : "posts?select=*&order=criado_em.desc";
  return supabaseRequest<Post[]>(query);
}

async function getPostById(id: string, clienteId?: string): Promise<Post | null> {
  if (!(await canUseSupabase())) {
    return memoryStore.posts.find((post) => post.id === id && (!clienteId || post.cliente_id === clienteId)) || null;
  }

  const records = await supabaseRequest<Post[]>(
    clienteId
      ? `posts?id=eq.${sanitizeId(id)}&cliente_id=eq.${sanitizeId(clienteId)}&select=*`
      : `posts?id=eq.${sanitizeId(id)}&select=*`,
  );
  return records[0] || null;
}

async function createPostRecord(payload: Omit<Post, "id">): Promise<Post> {
  if (!(await canUseSupabase())) {
    const record: Post = { id: randomUUID(), ...payload };
    memoryStore.posts.unshift(record);
    return record;
  }

  const created = await supabaseRequest<Post[]>("posts", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  return created[0];
}

async function updatePostRecord(id: string, patch: Partial<Post> & { cliente_id?: string }): Promise<Post> {
  if (!(await canUseSupabase())) {
    const index = memoryStore.posts.findIndex((post) => post.id === id && (!patch.cliente_id || post.cliente_id === patch.cliente_id));
    if (index === -1) {
      throw new Error("Post nÃ£o encontrado.");
    }
    memoryStore.posts[index] = { ...memoryStore.posts[index], ...patch };
    return memoryStore.posts[index];
  }

  const updated = await supabaseRequest<Post[]>(
    patch.cliente_id
      ? `posts?id=eq.${sanitizeId(id)}&cliente_id=eq.${sanitizeId(patch.cliente_id)}`
      : `posts?id=eq.${sanitizeId(id)}`,
    {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
    },
  );

  if (!updated[0]) {
    throw new Error("Post nÃ£o encontrado.");
  }

  return updated[0];
}

async function deletePostRecord(id: string, clienteId?: string): Promise<Post | null> {
  if (!(await canUseSupabase())) {
    const index = memoryStore.posts.findIndex((post) => post.id === id && (!clienteId || post.cliente_id === clienteId));
    if (index === -1) {
      return null;
    }
    const [deleted] = memoryStore.posts.splice(index, 1);
    return deleted;
  }

  const deleted = await supabaseRequest<Post[]>(
    clienteId ? `posts?id=eq.${sanitizeId(id)}&cliente_id=eq.${sanitizeId(clienteId)}` : `posts?id=eq.${sanitizeId(id)}`,
    {
    method: "DELETE",
    headers: {
      Prefer: "return=representation",
    },
    },
  );

  return deleted[0] || null;
}

async function listHistory(clienteId?: string): Promise<HistoricoPost[]> {
  if (!(await canUseSupabase())) {
    const items = clienteId ? memoryStore.historicos.filter((item) => item.cliente_id === clienteId) : memoryStore.historicos;
    return [...items].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }

  const query = clienteId
    ? `historico_posts?select=*&cliente_id=eq.${sanitizeId(clienteId)}&order=criado_em.desc`
    : "historico_posts?select=*&order=criado_em.desc";
  return supabaseRequest<HistoricoPost[]>(query);
}

async function createHistoryRecord(payload: Omit<HistoricoPost, "id">): Promise<HistoricoPost> {
  if (!(await canUseSupabase())) {
    const record: HistoricoPost = { id: randomUUID(), ...payload };
    memoryStore.historicos.unshift(record);
    return record;
  }

  const created = await supabaseRequest<HistoricoPost[]>("historico_posts", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  return created[0];
}

async function listLogs(clienteId?: string): Promise<LogMessage[]> {
  if (!(await canUseSupabase())) {
    const items = clienteId ? memoryStore.logs.filter((item) => item.cliente_id === clienteId) : memoryStore.logs;
    return [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  try {
    const query = clienteId ? `logs?select=*&cliente_id=eq.${sanitizeId(clienteId)}&order=timestamp.desc` : "logs?select=*&order=timestamp.desc";
    return await supabaseRequest<LogMessage[]>(query);
  } catch {
    const items = clienteId ? memoryStore.logs.filter((item) => item.cliente_id === clienteId) : memoryStore.logs;
    return [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}

async function createLogRecord(payload: Omit<LogMessage, "id">): Promise<LogMessage> {
  if (!(await canUseSupabase())) {
    const record: LogMessage = { id: randomUUID(), ...payload };
    memoryStore.logs.unshift(record);
    memoryStore.logs = memoryStore.logs.slice(0, 200);
    return record;
  }

  try {
    const created = await supabaseRequest<LogMessage[]>("logs", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });
    return created[0];
  } catch {
    const record: LogMessage = { id: randomUUID(), ...payload };
    memoryStore.logs.unshift(record);
    memoryStore.logs = memoryStore.logs.slice(0, 200);
    return record;
  }
}

async function clearLogRecords(clienteId?: string): Promise<void> {
  memoryStore.logs = clienteId ? memoryStore.logs.filter((log) => log.cliente_id !== clienteId) : [];

  if (!(await canUseSupabase())) {
    return;
  }

  try {
    const query = clienteId ? `logs?cliente_id=eq.${sanitizeId(clienteId)}&id=not.is.null` : "logs?id=not.is.null";
    await supabaseRequest<unknown>(query, {
      method: "DELETE",
    });
  } catch {
    // Ignore if logs table is not available yet.
  }
}

async function listUsers(): Promise<Usuario[]> {
  if (!(await canUseSupabase())) {
    return [...memoryStore.usuarios];
  }

  const columns = await getUsuariosColumns();
  const roleColumnAvailable = columns.includes("perfil_publicacao");
  const selectColumns = ["id", "nome", "email", "perfil", "criado_em"];
  if (columns.includes("auth_user_id")) selectColumns.push("auth_user_id");
  if (columns.includes("status")) selectColumns.push("status");
  if (columns.includes("ativo")) selectColumns.push("ativo");
  if (roleColumnAvailable) selectColumns.push("perfil_publicacao");
  const orderColumn = columns.includes("criado_em") ? "criado_em.asc" : "email.asc";

  const finalUsersRaw = await supabaseRequest<Record<string, unknown>[]>(
    `usuarios?select=${selectColumns.join(",")}&order=${orderColumn}`,
  );
  return finalUsersRaw.map(mapSupabaseUserRecord);
}

async function updateUserRecord(
  id: string,
  patch: Partial<Pick<Usuario, "nome" | "email" | "perfil" | "perfil_publicacao" | "ativo">>,
): Promise<Usuario> {
  if (!(await canUseSupabase())) {
    const index = memoryStore.usuarios.findIndex((user) => user.id === id);
    if (index === -1) {
      throw new Error("UsuÃ¡rio nÃ£o encontrado.");
    }

    memoryStore.usuarios[index] = {
      ...memoryStore.usuarios[index],
      ...patch,
    };

    return memoryStore.usuarios[index];
  }

  const columns = await getUsuariosColumns();
  const payload: Record<string, unknown> = {
    atualizado_em: new Date().toISOString(),
  };

  if (patch.nome !== undefined) payload.nome = patch.nome;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.perfil !== undefined) payload.perfil = patch.perfil;
  if (patch.perfil_publicacao !== undefined && columns.includes("perfil_publicacao")) {
    payload.perfil_publicacao = patch.perfil_publicacao;
  }
  if (patch.ativo !== undefined && columns.includes("ativo")) {
    payload.ativo = patch.ativo;
  }
  if (patch.ativo !== undefined && columns.includes("status")) {
    payload.status = patch.ativo ? "ATIVO" : "INATIVO";
  }

  const updated = await supabaseRequest<Record<string, unknown>[]>(
    `usuarios?id=eq.${sanitizeId(id)}&select=*`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!updated[0]) {
    throw new Error("UsuÃ¡rio nÃ£o encontrado.");
  }

  usuariosColumnsCache = null;
  return mapSupabaseUserRecord(updated[0]);
}

async function createOperationalUserRecord(payload: {
  nome: string;
  email: string;
  perfil_publicacao: PerfilPublicacao;
  ativo: boolean;
  auth_user_id?: string;
}): Promise<Usuario> {
  if (!(await canUseSupabase())) {
    const record: Usuario = {
      id: randomUUID(),
      nome: payload.nome,
      email: payload.email,
      perfil: payload.perfil_publicacao === "ADMIN" ? "ADMINISTRADOR" : "USUARIO",
      perfil_publicacao: payload.perfil_publicacao,
      ativo: payload.ativo,
      criado_em: new Date().toISOString(),
      auth_user_id: payload.auth_user_id,
    };
    memoryStore.usuarios.push(record);
    return record;
  }

  const columns = await getUsuariosColumns();
  const body: Record<string, unknown> = {
    nome: payload.nome,
    email: payload.email,
    perfil: payload.perfil_publicacao === "ADMIN" ? "ADMIN" : "OPERADOR",
    atualizado_em: new Date().toISOString(),
  };

  if (columns.includes("auth_user_id") && payload.auth_user_id) {
    body.auth_user_id = payload.auth_user_id;
  }
  if (columns.includes("perfil_publicacao")) {
    body.perfil_publicacao = payload.perfil_publicacao;
  }
  if (columns.includes("status")) {
    body.status = payload.ativo ? "ATIVO" : "INATIVO";
  }
  if (columns.includes("ativo")) {
    body.ativo = payload.ativo;
  }
  if (columns.includes("origem_dado")) {
    body.origem_dado = "SISTEMA";
  }
  if (columns.includes("criado_via_sistema")) {
    body.criado_via_sistema = true;
  }

  const created = await supabaseRequest<Record<string, unknown>[]>("usuarios", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!created[0]) {
    throw new Error("Falha ao criar usuÃ¡rio operacional.");
  }

  usuariosColumnsCache = null;
  return mapSupabaseUserRecord(created[0]);
}

async function listClienteUsuarios(clienteId: string): Promise<ClienteUsuario[]> {
  if (!(await canUseSupabase())) {
    return memoryStore.clienteUsuarios.filter((item) => item.cliente_id === clienteId);
  }

  try {
    return await supabaseRequest<ClienteUsuario[]>(
      `cliente_usuarios?cliente_id=eq.${sanitizeId(clienteId)}&select=*&order=criado_em.desc`,
    );
  } catch {
    return memoryStore.clienteUsuarios.filter((item) => item.cliente_id === clienteId);
  }
}

async function upsertClienteUsuario(clienteId: string, payload: Omit<ClienteUsuario, "id" | "cliente_id" | "criado_em"> & { usuario_id: string }) {
  const now = new Date().toISOString();
  const existing = (await listClienteUsuarios(clienteId)).find((item) => item.usuario_id === payload.usuario_id);
  const record: ClienteUsuario = {
    id: existing?.id || randomUUID(),
    cliente_id: clienteId,
    usuario_id: payload.usuario_id,
    perfil: payload.perfil,
    status: payload.status,
    criado_em: existing?.criado_em || now,
  };

  if (!(await canUseSupabase())) {
    const idx = memoryStore.clienteUsuarios.findIndex((item) => item.cliente_id === clienteId && item.usuario_id === payload.usuario_id);
    if (idx >= 0) memoryStore.clienteUsuarios[idx] = record;
    else memoryStore.clienteUsuarios.unshift(record);
    return record;
  }

  const method = existing ? "PATCH" : "POST";
  const endpoint = existing
    ? `cliente_usuarios?cliente_id=eq.${sanitizeId(clienteId)}&usuario_id=eq.${sanitizeId(payload.usuario_id)}`
    : "cliente_usuarios";
  const result = await supabaseRequest<ClienteUsuario[]>(endpoint, {
    method,
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  return result[0] || record;
}

async function deleteOperationalUserRecord(id: string): Promise<Usuario | null> {
  if (!(await canUseSupabase())) {
    const index = memoryStore.usuarios.findIndex((user) => user.id === id);
    if (index === -1) {
      return null;
    }

    const [deleted] = memoryStore.usuarios.splice(index, 1);
    return deleted;
  }

  const deleted = await supabaseRequest<Record<string, unknown>[]>(`usuarios?id=eq.${sanitizeId(id)}&select=*`, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation",
    },
  });

  usuariosColumnsCache = null;
  return deleted[0] ? mapSupabaseUserRecord(deleted[0]) : null;
}

async function createSupabaseAuthUser(payload: { email: string; password: string; nome: string }): Promise<string> {
  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        nome: payload.nome,
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Falha ao criar usuÃ¡rio no Supabase Auth: ${text}`);
  }

  const data = JSON.parse(text) as { id?: string; user?: { id?: string } };
  const authUserId = data.user?.id || data.id;
  if (!authUserId) {
    throw new Error("Supabase Auth nÃ£o retornou o ID do usuÃ¡rio criado.");
  }

  return authUserId;
}

async function deleteSupabaseAuthUser(authUserId: string): Promise<void> {
  if (!authUserId) {
    return;
  }

  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "DELETE",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao excluir usuÃ¡rio no Supabase Auth: ${await response.text()}`);
  }
}

async function updateSupabaseAuthUser(
  authUserId: string,
  payload: { email?: string; password?: string; nome?: string },
): Promise<void> {
  if (!authUserId) {
    throw new Error("UsuÃ¡rio sem vÃ­nculo com Supabase Auth.");
  }

  const body: Record<string, unknown> = {};
  if (payload.email) body.email = payload.email;
  if (payload.password) body.password = payload.password;
  if (payload.nome) {
    body.user_metadata = {
      nome: payload.nome,
    };
  }

  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "PUT",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Falha ao atualizar usuÃ¡rio no Supabase Auth: ${await response.text()}`);
  }
}

async function findSupabaseAuthUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const config = getRuntimeConfig();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao listar usuÃ¡rios do Supabase Auth: ${await response.text()}`);
  }

  const data = (await response.json()) as { users?: Array<{ id?: string; email?: string }> };
  const match = (data.users || []).find((user) => String(user.email || "").toLowerCase() === normalizedEmail);
  if (!match?.id || !match.email) {
    return null;
  }

  return {
    id: match.id,
    email: match.email,
  };
}

function getAuthorizationToken(headerValue: string | string[] | undefined): string {
  const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const match = (rawValue || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function fetchSupabaseAuthUser(accessToken: string): Promise<AuthenticatedSupabaseUser> {
  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.supabaseAnonKey || config.supabaseServiceRoleKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(401, "SessÃ£o invÃ¡lida ou expirada. FaÃ§a login novamente.");
  }

  if (!response.ok) {
    throw new Error(`Falha ao validar sessÃ£o no Supabase Auth: ${await response.text()}`);
  }

  const user = (await response.json()) as { id?: string; email?: string };
  if (!user.id || !user.email) {
    throw new HttpError(401, "SessÃ£o do Supabase sem identificaÃ§Ã£o de usuÃ¡rio.");
  }

  return {
    id: user.id,
    email: user.email,
  };
}

async function linkOperationalUserToAuthIdentity(userId: string, authUserId: string): Promise<void> {
  const columns = await getUsuariosColumns();
  if (!columns.includes("auth_user_id")) {
    return;
  }

  await supabaseRequest<Record<string, unknown>[]>(`usuarios?id=eq.${sanitizeId(userId)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      auth_user_id: authUserId,
      atualizado_em: new Date().toISOString(),
    }),
  });
}

async function findOperationalUserByAuthIdentity(authUser: AuthenticatedSupabaseUser): Promise<Usuario | null> {
  const users = await listUsers();
  const authUserId = authUser.id.toLowerCase();
  const email = authUser.email.toLowerCase();

  const linkedUser = users.find((user) => String(user.auth_user_id || "").toLowerCase() === authUserId);
  if (linkedUser) {
    return linkedUser;
  }

  const emailUser = users.find((user) => user.email.toLowerCase() === email);
  if (!emailUser) {
    return null;
  }

  if (!emailUser.auth_user_id) {
    await linkOperationalUserToAuthIdentity(emailUser.id, authUser.id);
    return {
      ...emailUser,
      auth_user_id: authUser.id,
    };
  }

  return emailUser;
}

async function addLog(
  service: LogMessage["service"],
  type: LogMessage["type"],
  message: string,
  payload?: unknown,
  clienteId?: string,
): Promise<void> {
  await createLogRecord({
    cliente_id: clienteId || null,
    timestamp: new Date().toISOString(),
    service,
    type,
    message,
    payload: toJsonString(payload),
  });
}

function buildCaption(post: Post): string {
  const base = post.legenda?.trim() || post.titulo;
  const hashtags = post.hashtags?.trim();
  return hashtags ? `${base}\n\n${hashtags}` : base;
}

function inferPostType(mimeType?: string, filename?: string): Post["tipo"] {
  const normalizedMime = (mimeType || "").toLowerCase();
  const normalizedName = (filename || "").toLowerCase();
  if (
    normalizedMime.startsWith("video/") ||
    normalizedMime === "video" ||
    normalizedMime === "reels" ||
    normalizedName.endsWith(".mp4") ||
    normalizedName.endsWith(".mov") ||
    normalizedName.endsWith(".webm")
  ) {
    return "VIDEO";
  }
  return "IMAGEM";
}

function normalizePostTypeInput(rawType: unknown, filename?: string): Post["tipo"] {
  if (rawType === "IMAGEM" || rawType === "VIDEO" || rawType === "REELS") {
    return rawType;
  }

  return inferPostType(typeof rawType === "string" ? rawType : undefined, filename);
}

const MAX_INLINE_VIDEO_UPLOAD_BYTES = 45 * 1024 * 1024;
const ACCEPTED_VIDEO_UPLOAD_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-m4v"]);
const INSTAGRAM_CONTAINER_WAIT_TIMEOUT_MS = Number(process.env.INSTAGRAM_CONTAINER_WAIT_TIMEOUT_MS || 240000);
const INSTAGRAM_CONTAINER_WAIT_POLL_MS = Number(process.env.INSTAGRAM_CONTAINER_WAIT_POLL_MS || 4000);

function getPublishingMediaUrl(post: Post): string | undefined {
  return post.video_editado_drive_url || post.drive_url;
}

function assertPublicMediaUrl(mediaUrl: string | undefined, mediaKind: "imagem" | "vÃ­deo"): string {
  if (!mediaUrl) {
    throw new Error(`${mediaKind === "vÃ­deo" ? "VÃ­deo" : "Imagem"} sem URL pÃºblica para publicaÃ§Ã£o.`);
  }

  if (isLocalhostUrl(mediaUrl)) {
    throw new Error(
      `APP_URL precisa apontar para uma URL pÃºblica. A URL atual da mÃ­dia (${mediaUrl}) nÃ£o pode ser acessada pela Meta.`,
    );
  }

  return mediaUrl;
}

function assertVideoPostCanAdvance(payload: {
  tipo?: Post["tipo"];
  status?: PostStatus;
  media_validation_status?: Post["media_validation_status"];
}) {
  const isVideo = payload.tipo === "VIDEO" || payload.tipo === "REELS";
  const isPending = payload.status === "PENDENTE";
  if (isVideo && isPending && payload.media_validation_status === "INVALID") {
    throw new HttpError(400, "VIDEO_INVALID");
  }
}

function filenameToTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Post importado";
}

function getMediaProxyUrl(fileId: string, clienteId?: string | null): string {
  const config = getRuntimeConfig();
  const signature = createHmac("sha256", config.mediaUrlSigningSecret).update(fileId).digest("hex");
  const params = new URLSearchParams({
    signature,
  });
  if (clienteId) {
    params.set("cliente_id", clienteId);
  }
  return `${config.appUrl}/api/media/${encodeURIComponent(fileId)}?${params.toString()}`;
}

function verifyMediaSignature(fileId: string, signature?: string): boolean {
  if (!signature) return false;
  const config = getRuntimeConfig();
  const expected = createHmac("sha256", config.mediaUrlSigningSecret).update(fileId).digest("hex");
  return signature === expected;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("Arquivo recebido em formato invÃ¡lido.");
  }

  return {
    mimeType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64"),
  };
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleAccessToken(clienteId?: string | null): Promise<string> {
  const config = getRuntimeConfig();
  const context = await getClienteOperationalContext(clienteId);
  const driveScope = "https://www.googleapis.com/auth/drive";

  if (config.googleClientEmail && config.googlePrivateKey) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claimSet = base64UrlEncode(
      JSON.stringify({
        iss: config.googleClientEmail,
        scope: driveScope,
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      }),
    );
    const unsigned = `${header}.${claimSet}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(config.googlePrivateKey);
    const assertion = `${unsigned}.${base64UrlEncode(signature)}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao autenticar service account: ${await response.text()}`);
    }

    const json = (await response.json()) as GoogleAccessTokenResponse;
    return json.access_token;
  }

  if (!config.googleClientId || !config.googleClientSecret || !context.googleRefreshToken) {
    throw new Error("Credenciais do Google Drive incompletas para o cliente atual.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: context.googleRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao atualizar token do Google: ${await response.text()}`);
  }

  const json = (await response.json()) as GoogleAccessTokenResponse;
  return json.access_token;
}

async function googleDriveRequest<T>(resource: string, init?: RequestInit): Promise<T> {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/${resource}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Drive ${response.status}: ${await response.text()}`);
  }

  return safeParseJson<T>(response);
}

async function googleDriveRequestForClient<T>(
  clienteId: string | null | undefined,
  resource: string,
  init?: RequestInit,
): Promise<T> {
  const accessToken = await getGoogleAccessToken(clienteId);
  const response = await fetch(`https://www.googleapis.com/drive/v3/${resource}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Drive ${response.status}: ${await response.text()}`);
  }

  return safeParseJson<T>(response);
}

async function findOrCreateDriveFolder(name: string, parentId: string): Promise<string> {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${name}' and '${parentId}' in parents`,
  );

  const existing = await googleDriveRequest<{ files: Array<{ id: string }> }>(
    `files?q=${query}&fields=files(id)&includeItemsFromAllDrives=true&supportsAllDrives=true`,
  );

  if (existing.files[0]?.id) {
    return existing.files[0].id;
  }

  const accessToken = await getGoogleAccessToken();
  const response = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao criar pasta ${name}: ${await response.text()}`);
  }

  const json = (await response.json()) as { id: string };
  return json.id;
}

async function findOrCreateDriveFolderForClient(
  clienteId: string | null | undefined,
  name: string,
  parentId: string,
): Promise<string> {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${name}' and '${parentId}' in parents`,
  );

  const existing = await googleDriveRequestForClient<{ files: Array<{ id: string }> }>(
    clienteId,
    `files?q=${query}&fields=files(id)&includeItemsFromAllDrives=true&supportsAllDrives=true`,
  );

  if (existing.files[0]?.id) {
    return existing.files[0].id;
  }

  const accessToken = await getGoogleAccessToken(clienteId);
  const response = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao criar pasta ${name}: ${await response.text()}`);
  }

  const json = (await response.json()) as { id: string };
  return json.id;
}

async function ensureDriveFolders(clienteId?: string | null): Promise<DriveFolderMap> {
  const context = await getClienteOperationalContext(clienteId);
  if (!context.driveRootId) {
    throw new Error("Cliente sem pasta raiz do Google Drive configurada.");
  }

  const entradaId =
    context.driveEntradaId || (await findOrCreateDriveFolderForClient(clienteId, "01 Entrada", context.driveRootId));
  const aprovacaoId =
    context.driveAprovacaoId || (await findOrCreateDriveFolderForClient(clienteId, "02 Em Aprovacao", context.driveRootId));
  const aprovadosId =
    context.driveAprovadosId || (await findOrCreateDriveFolderForClient(clienteId, "03 Aprovados", context.driveRootId));
  const publicadosId =
    context.drivePublishedId || (await findOrCreateDriveFolderForClient(clienteId, "04 Publicados", context.driveRootId));
  const rejeitadosId =
    context.driveRejeitadosId || (await findOrCreateDriveFolderForClient(clienteId, "05 Rejeitados", context.driveRootId));
  const arquivadosId =
    context.driveArquivadosId || (await findOrCreateDriveFolderForClient(clienteId, "06 Arquivados", context.driveRootId));

  if (clienteId) {
    await updateClienteIntegracaoRecord(clienteId, {
      google_drive_entrada_folder_id: entradaId,
      google_drive_aprovacao_folder_id: aprovacaoId,
      google_drive_aprovados_folder_id: aprovadosId,
      google_drive_publicados_folder_id: publicadosId,
      google_drive_rejeitados_folder_id: rejeitadosId,
      google_drive_arquivados_folder_id: arquivadosId,
      google_drive_imagens_folder_id: entradaId,
      google_drive_videos_folder_id: null,
    });
  }

  return {
    rootId: context.driveRootId,
    entradaId,
    aprovacaoId,
    aprovadosId,
    publicadosId,
    rejeitadosId,
    arquivadosId,
  };
}

function renderOauthPopupResultPage(title: string, message: string, payload: Record<string, unknown>): string {
  const safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
      main { max-width: 760px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
      h1 { margin-top: 0; font-size: 24px; }
      p { line-height: 1.5; }
      .muted { color: #475569; font-size: 14px; }
      .ok { color: #166534; }
      .warn { color: #92400e; }
    </style>
  </head>
  <body>
    <main>
      <h1 class="ok">${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p class="muted" id="popup-status">Tentando devolver o resultado para a aplicação que abriu esta janela.</p>
      <p class="muted">Se esta janela não fechar automaticamente, finalize manualmente e volte para a aplicação.</p>
    </main>
    <script>
      (function () {
        const payload = ${safePayload};
        const status = document.getElementById('popup-status');
        let canAutoClose = false;
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, '*');
            try {
              canAutoClose = window.opener.location && window.opener.location.origin === window.location.origin;
            } catch (_error) {
              canAutoClose = false;
            }
          }
        } catch (_error) {
          canAutoClose = false;
        }
        if (canAutoClose) {
          if (status) status.textContent = 'Conexão concluída. Fechando a janela...';
          window.close();
          return;
        }
        if (status) {
          status.textContent = 'Conexão concluída, mas a janela foi mantida aberta porque o retorno aconteceu em outra origem.';
        }
      })();
    </script>
  </body>
</html>`;
}

async function uploadFileToGoogleDrive(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}, clienteId?: string | null): Promise<{ fileId: string; url: string; folderName: string }> {
  const folders = await ensureDriveFolders(clienteId);
  const parentId = folders.entradaId;
  const folderName = "01 Entrada";
  const accessToken = await getGoogleAccessToken(clienteId);
  const boundary = `instaflow-${Date.now()}`;
  const metadata = {
    name: input.filename,
    parents: [parentId],
  };

  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`),
    input.buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    throw new Error(`Falha no upload ao Google Drive: ${await response.text()}`);
  }

  const file = (await response.json()) as { id: string };
  return {
    fileId: file.id,
    url: getMediaProxyUrl(file.id, clienteId),
    folderName,
  };
}

async function listDriveFilesFromFolder(folderId: string): Promise<
  Array<{ id: string; name: string; mimeType: string; createdTime?: string }>
> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const response = await googleDriveRequest<{
    files: Array<{ id: string; name: string; mimeType: string; createdTime?: string }>;
  }>(
    `files?q=${query}&fields=files(id,name,mimeType,createdTime)&includeItemsFromAllDrives=true&supportsAllDrives=true`,
  );

  return response.files.filter((file) => {
    const type = inferPostType(file.mimeType, file.name);
    return type === "IMAGEM" || type === "VIDEO";
  });
}

async function listDriveFilesFromFolderForClient(
  clienteId: string | null | undefined,
  folderId: string,
): Promise<Array<{ id: string; name: string; mimeType: string; createdTime?: string }>> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const response = await googleDriveRequestForClient<{
    files: Array<{ id: string; name: string; mimeType: string; createdTime?: string }>;
  }>(
    clienteId,
    `files?q=${query}&fields=files(id,name,mimeType,createdTime)&includeItemsFromAllDrives=true&supportsAllDrives=true`,
  );

  return response.files.filter((file) => {
    const type = inferPostType(file.mimeType, file.name);
    return type === "IMAGEM" || type === "VIDEO";
  });
}

async function testDriveFolderAccess(folderId: string): Promise<{ id: string; name: string; mimeType: string; itemCount: number }> {
  if (!folderId) {
    throw new Error("Informe o ID da pasta raiz do Google Drive.");
  }

  const folder = await googleDriveRequest<{ id: string; name: string; mimeType: string }>(
    `files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
  );

  if (folder.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("O ID informado não pertence a uma pasta do Google Drive.");
  }

  const children = await listDriveFilesFromFolder(folderId);
  return {
    ...folder,
    itemCount: children.length,
  };
}

async function testDriveFolderAccessForClient(
  clienteId: string | null | undefined,
  folderId: string,
): Promise<{ id: string; name: string; mimeType: string; itemCount: number }> {
  if (!folderId) {
    throw new Error("Informe o ID da pasta raiz do Google Drive.");
  }

  const folder = await googleDriveRequestForClient<{ id: string; name: string; mimeType: string }>(
    clienteId,
    `files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
  );

  if (folder.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("O ID informado não pertence a uma pasta do Google Drive.");
  }

  const children = await listDriveFilesFromFolderForClient(clienteId, folderId);
  return {
    ...folder,
    itemCount: children.length,
  };
}

async function moveDriveFileToPublishedFolder(fileId: string, clienteId?: string | null): Promise<void> {
  const folders = await ensureDriveFolders(clienteId);
  const metadata = await googleDriveRequestForClient<{ parents?: string[] }>(
    clienteId,
    `files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`,
  );
  const removeParents = metadata.parents?.join(",") || "";
  const accessToken = await getGoogleAccessToken(clienteId);
  const params = new URLSearchParams({
    addParents: folders.publicadosId,
    supportsAllDrives: "true",
  });

  if (removeParents) {
    params.set("removeParents", removeParents);
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Falha ao mover arquivo para Publicados: ${await response.text()}`);
  }
}

async function metaGraphRequest<T>(resource: string, init?: RequestInit): Promise<T> {
  const config = getRuntimeConfig();
  const response = await fetch(`https://graph.facebook.com/${config.graphApiVersion}${resource}`, init);
  if (!response.ok) {
    throw new Error(`Meta Graph ${response.status}: ${await response.text()}`);
  }
  return safeParseJson<T>(response);
}

function getInstagramPublishingActorId(context: ClienteOperationalContext): string {
  return context.instagramUserId || context.instagramBusinessId;
}

function getInstagramApiBaseUrl(context: ClienteOperationalContext): string {
  if (context.instagramConnectionMode === "INSTAGRAM_LOGIN") {
    return "https://graph.instagram.com";
  }
  return context.instagramGraphBaseUrl.replace(/\/$/, "") || "https://graph.facebook.com";
}

async function ensureInstagramAccessToken(context: ClienteOperationalContext): Promise<string> {
  if (!context.clienteId || context.instagramConnectionMode !== "INSTAGRAM_LOGIN" || !context.instagramAccessToken) {
    return context.instagramAccessToken;
  }

  const expiresAt = context.instagramTokenExpiresAt ? new Date(context.instagramTokenExpiresAt).getTime() : 0;
  const refreshThreshold = Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (!expiresAt || expiresAt > refreshThreshold) {
    return context.instagramAccessToken;
  }

  const refreshed = await refreshInstagramLongLivedAccessToken(context.instagramAccessToken);
  const nextToken = trimEnv(refreshed.access_token || context.instagramAccessToken);
  await updateClienteIntegracaoRecord(context.clienteId, {
    instagram_access_token_encrypted: nextToken ? encryptSecretValue(nextToken) : null,
    instagram_token_expires_at: resolveExpiresAtFromSeconds(refreshed.expires_in),
    instagram_token_status: nextToken ? "ATIVO" : "ERRO",
    instagram_last_sync_at: new Date().toISOString(),
  });
  return nextToken;
}

async function instagramGraphRequest<T>(
  context: ClienteOperationalContext,
  resource: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = getInstagramApiBaseUrl(context);
  const usableToken = await ensureInstagramAccessToken(context);
  const shouldReplaceToken = Boolean(context.instagramAccessToken && usableToken && context.instagramAccessToken !== usableToken);
  const normalizedResource = shouldReplaceToken ? resource.replaceAll(context.instagramAccessToken, usableToken) : resource;
  const nextInit: RequestInit | undefined = init
    ? {
        ...init,
        body:
          shouldReplaceToken && init.body instanceof URLSearchParams
            ? new URLSearchParams(
                init.body.toString().replaceAll(context.instagramAccessToken, usableToken),
              )
            : shouldReplaceToken && typeof init.body === "string"
              ? init.body.replaceAll(context.instagramAccessToken, usableToken)
              : init.body,
      }
    : init;
  const response = await fetch(`${baseUrl}/${context.graphApiVersion}${normalizedResource}`, nextInit);
  if (!response.ok) {
    const rawBody = await response.text();
    if (
      context.clienteId &&
      (rawBody.includes('"code":190') ||
        rawBody.includes('"code": 190') ||
        rawBody.includes("Invalid OAuth access token"))
    ) {
      await setClienteInstagramStatus(context.clienteId, "ERRO", {
        instagram_last_sync_at: new Date().toISOString(),
      }).catch(() => undefined);
    }
    throw new Error(`Instagram Graph ${response.status}: ${rawBody}`);
  }
  return safeParseJson<T>(response);
}

async function createInstagramContainer(post: Post): Promise<string> {
  const context = await getClienteOperationalContext(post.cliente_id || null);
  const publishingActorId = getInstagramPublishingActorId(context);
  const body = new URLSearchParams({
    access_token: context.instagramAccessToken,
    caption: buildCaption(post),
  });

  if (post.tipo === "VIDEO" || post.tipo === "REELS") {
    const mediaUrl = assertPublicMediaUrl(getPublishingMediaUrl(post), "vÃ­deo");
    body.set("media_type", "REELS");
    body.set("video_url", mediaUrl);
  } else {
    body.set("image_url", assertPublicMediaUrl(post.drive_url, "imagem"));
  }

  const result = await instagramGraphRequest<{ id: string }>(context, `/${publishingActorId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return result.id;
}

async function waitForContainerReady(containerId: string, clienteId?: string | null): Promise<void> {
  const context = await getClienteOperationalContext(clienteId);
  const startedAt = Date.now();
  let lastStatusCode: string | undefined;

  for (let attempt = 0; Date.now() - startedAt < INSTAGRAM_CONTAINER_WAIT_TIMEOUT_MS; attempt += 1) {
    const status = await instagramGraphRequest<{ status_code?: string; status?: string }>(
      context,
      `/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(context.instagramAccessToken)}`,
    );

    const code = status.status_code || status.status;
    lastStatusCode = code;
    if (code === "FINISHED" || code === "PUBLISHED") {
      return;
    }
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Container do Instagram retornou status ${code}.`);
    }

    const remaining = INSTAGRAM_CONTAINER_WAIT_TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining <= 0) {
      break;
    }
    await sleep(Math.min(INSTAGRAM_CONTAINER_WAIT_POLL_MS, remaining));
  }

  throw new Error(
    `Tempo esgotado aguardando processamento da mÃ­dia no Instagram. Ãšltimo status: ${lastStatusCode || "desconhecido"}.`,
  );
}

async function publishInstagramContainer(
  creationId: string,
  clienteId?: string | null,
): Promise<{ mediaId: string; permalink?: string }> {
  const context = await getClienteOperationalContext(clienteId);
  const publishingActorId = getInstagramPublishingActorId(context);
  const publishBody = new URLSearchParams({
    creation_id: creationId,
    access_token: context.instagramAccessToken,
  });

  const published = await instagramGraphRequest<{ id: string }>(context, `/${publishingActorId}/media_publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: publishBody,
  });

  let permalink: string | undefined;
  try {
    const media = await instagramGraphRequest<{ permalink?: string }>(
      context,
      `/${published.id}?fields=permalink&access_token=${encodeURIComponent(context.instagramAccessToken)}`,
    );
    permalink = media.permalink;
  } catch {
    permalink = undefined;
  }

  return {
    mediaId: published.id,
    permalink,
  };
}

async function exchangeInstagramCodeForToken(code: string): Promise<Record<string, unknown>> {
  const config = getRuntimeConfig();
  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.instagramAppId,
      client_secret: config.instagramAppSecret,
      grant_type: "authorization_code",
      redirect_uri: config.instagramRedirectUri,
      code,
    }),
  });
  if (!response.ok) {
    throw new Error(`Instagram OAuth ${response.status}: ${await response.text()}`);
  }
  return safeParseJson<Record<string, unknown>>(response);
}

async function exchangeInstagramShortLivedForLongLivedToken(
  shortLivedToken: string,
): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const config = getRuntimeConfig();
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", config.instagramAppSecret);
  url.searchParams.set("access_token", shortLivedToken);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Instagram long-lived token ${response.status}: ${await response.text()}`);
  }
  return safeParseJson<{ access_token: string; token_type?: string; expires_in?: number }>(response);
}

async function refreshInstagramLongLivedAccessToken(
  currentToken: string,
): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", currentToken);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Instagram refresh token ${response.status}: ${await response.text()}`);
  }
  return safeParseJson<{ access_token: string; token_type?: string; expires_in?: number }>(response);
}

function resolveExpiresAtFromSeconds(expiresIn?: number | string | null): string | null {
  const seconds = Number(expiresIn || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function exchangeMetaCodeForToken(code: string): Promise<Record<string, unknown>> {
  const config = getRuntimeConfig();
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`);
  url.searchParams.set("client_id", config.metaAppId);
  url.searchParams.set("client_secret", config.metaAppSecret);
  url.searchParams.set("redirect_uri", config.metaRedirectUri);
  url.searchParams.set("code", code);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Meta OAuth ${response.status}: ${await response.text()}`);
  }
  return safeParseJson<Record<string, unknown>>(response);
}

async function syncInstagramPostInsights(clienteId: string, postId: string): Promise<PostInsightResumo> {
  const post = await getPostById(postId, clienteId);
  if (!post) {
    throw new HttpError(404, "Post nÃ£o encontrado.");
  }
  const mediaId = post.instagram_media_id || post.instagram_post_id;
  if (!mediaId) {
    throw new HttpError(400, "Post ainda nÃ£o possui instagram_media_id para sincronizar insights.");
  }

  const context = await getClienteOperationalContext(clienteId);
  const media = await instagramGraphRequest<Record<string, unknown>>(
    context,
    `/${mediaId}?fields=id,permalink,like_count,comments_count,timestamp&access_token=${encodeURIComponent(context.instagramAccessToken)}`,
  );

  let insightsPayload: Record<string, unknown> | null = null;
  let reach = 0;
  let views = 0;
  let saved = 0;
  let shares = 0;
  try {
    insightsPayload = await instagramGraphRequest<Record<string, unknown>>(
      context,
      `/${mediaId}/insights?metric=reach,impressions,saved,shares&access_token=${encodeURIComponent(context.instagramAccessToken)}`,
    );
    const data = Array.isArray((insightsPayload as { data?: unknown[] }).data) ? ((insightsPayload as { data?: Record<string, unknown>[] }).data || []) : [];
    for (const item of data) {
      const name = String(item.name || "");
      const values = Array.isArray(item.values) ? item.values : [];
      const current = Number((values[0] as { value?: unknown } | undefined)?.value || 0);
      if (name === "reach") reach = current;
      if (name === "impressions") views = current;
      if (name === "saved") saved = current;
      if (name === "shares") shares = current;
    }
  } catch {
    insightsPayload = null;
  }

  const likes = Number(media.like_count || 0);
  const comments = Number(media.comments_count || 0);
  const total_interactions = likes + comments + saved + shares;
  const engagement_rate = reach > 0 ? Number(((total_interactions / reach) * 100).toFixed(2)) : 0;
  const now = new Date().toISOString();

  const resumo = await upsertPostInsightResumo({
    cliente_id: clienteId,
    post_id: postId,
    instagram_media_id: String(mediaId),
    views,
    reach,
    likes,
    comments,
    shares,
    saved,
    total_interactions,
    engagement_rate,
    last_sync_at: now,
    raw_payload: { media, insights: insightsPayload },
  });

  await updatePostRecord(postId, {
    cliente_id: clienteId,
    instagram_permalink: typeof media.permalink === "string" ? media.permalink : post.instagram_permalink || null,
    atualizado_em: now,
  });
  await addLog("Instagram API", "info", "Insights do post sincronizados.", { postId, mediaId }, clienteId);
  return resumo;
}

async function publishPost(post: Post, author: string): Promise<Post> {
  const context = await getClienteOperationalContext(post.cliente_id || null);
  const instagramApiBaseUrl = getInstagramApiBaseUrl(context);
  await addLog("Instagram API", "info", `Iniciando publicaÃ§Ã£o do post '${post.titulo}'.`, {
    postId: post.id,
    postType: post.tipo,
    publishingActorId: getInstagramPublishingActorId(context),
    graphBaseUrl: instagramApiBaseUrl,
  }, post.cliente_id || undefined);

  if (!(await canUseRealMode(post.cliente_id || null))) {
    const simulated = await updatePostRecord(post.id, {
      status: "PUBLICADA",
      instagram_post_id: `sim_${Date.now()}`,
      instagram_media_id: `sim_${Date.now()}`,
      instagram_publish_status: "PUBLICADO",
      data_publicacao: new Date().toISOString(),
      instagram_published_at: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      instagram_publish_error: null,
      erro_detalhe: undefined,
    });

    await createHistoryRecord({
      cliente_id: post.cliente_id || null,
      post_id: simulated.id,
      post_titulo: simulated.titulo,
      usuario: author,
      acao: "Publicado",
      observacao: "Modo real indisponÃ­vel. PublicaÃ§Ã£o mantida apenas em sandbox operacional.",
      criado_em: new Date().toISOString(),
    });

    await addLog("Instagram API", "warn", "PublicaÃ§Ã£o executada em sandbox por falta de configuraÃ§Ã£o completa.", {
      missingEnv: getRuntimeConfig().missingEnv,
      missingTables: (await inspectSupabaseSchema()).missingTables,
    }, post.cliente_id || undefined);

    return simulated;
  }

  const creationId = await createInstagramContainer(post);
  await addLog("Instagram API", "info", "Container de mÃ­dia criado na Meta.", {
    postId: post.id,
    creationId,
  }, post.cliente_id || undefined);

  await updatePostRecord(post.id, {
    creation_id: creationId,
    instagram_publish_status: "PUBLICANDO",
    status: "APROVADA",
    atualizado_em: new Date().toISOString(),
  });

  await waitForContainerReady(creationId, post.cliente_id || null);
  const published = await publishInstagramContainer(creationId, post.cliente_id || null);
  const next = await updatePostRecord(post.id, {
    status: "PUBLICADA",
    instagram_post_id: published.mediaId,
    instagram_media_id: published.mediaId,
    instagram_permalink: published.permalink || null,
    data_publicacao: new Date().toISOString(),
    instagram_published_at: new Date().toISOString(),
    instagram_publish_status: "PUBLICADO",
    atualizado_em: new Date().toISOString(),
    instagram_publish_error: null,
    erro_detalhe: undefined,
  });

  await createHistoryRecord({
    cliente_id: post.cliente_id || null,
    post_id: next.id,
    post_titulo: next.titulo,
    usuario: author,
    acao: "Publicado",
    observacao: published.permalink
      ? `PublicaÃ§Ã£o concluÃ­da com sucesso. Permalink: ${published.permalink}`
      : `PublicaÃ§Ã£o concluÃ­da com sucesso. Media ID: ${published.mediaId}`,
    criado_em: new Date().toISOString(),
  });

  await addLog("Instagram API", "success", `Post '${next.titulo}' publicado com sucesso.`, {
    mediaId: published.mediaId,
    permalink: published.permalink,
  }, next.cliente_id || undefined);

  if (next.drive_file_id) {
    try {
      await moveDriveFileToPublishedFolder(next.drive_file_id, next.cliente_id || null);
      await addLog("Google Drive", "info", "MÃ­dia movida para a pasta Publicados.", {
        fileId: next.drive_file_id,
      }, next.cliente_id || undefined);
    } catch (error) {
      await addLog("Google Drive", "warn", "Falha ao mover mÃ­dia para Publicados.", {
        fileId: next.drive_file_id,
        error: maskError(error),
      }, next.cliente_id || undefined);
    }
  }

  try {
    await syncInstagramPostInsights(next.cliente_id || "", next.id);
  } catch (error) {
    await addLog("Instagram API", "warn", "Falha ao sincronizar insights logo apÃ³s a publicaÃ§Ã£o.", {
      postId: next.id,
      error: maskError(error),
    }, next.cliente_id || undefined);
  }

  return next;
}

async function restorePostToModerationAfterPublishFailure(
  postId: string,
  clienteId: string | null | undefined,
  error: unknown,
  postTitle?: string,
  actorName?: string,
): Promise<void> {
  const detail = maskError(error);
  await updatePostRecord(postId, {
    status: "PENDENTE",
    instagram_publish_status: "ERRO_PUBLICACAO",
    instagram_publish_error: detail,
    erro_detalhe: detail,
    atualizado_em: new Date().toISOString(),
    cliente_id: clienteId || undefined,
  });

  await createHistoryRecord({
    cliente_id: clienteId || null,
    post_id: postId,
    post_titulo: postTitle || "Post",
    usuario: actorName || "Sistema",
    acao: "Falha na Publicacao",
    observacao: detail,
    criado_em: new Date().toISOString(),
  }).catch(() => undefined);
}

async function importGoogleDrivePosts(author: string, clienteId?: string | null): Promise<Post[]> {
  const folders = await ensureDriveFolders(clienteId);
  const files = await listDriveFilesFromFolderForClient(clienteId, folders.entradaId);
  const existingPosts = await listPosts(clienteId || undefined);
  const existingDriveIds = new Set(existingPosts.map((post) => post.drive_file_id).filter(Boolean));
  const createdPosts: Post[] = [];

  for (const file of files) {
    if (existingDriveIds.has(file.id)) {
      continue;
    }

    const now = new Date().toISOString();
    const payload: Omit<Post, "id"> = {
      cliente_id: clienteId || null,
      titulo: filenameToTitle(file.name),
      legenda: "",
      tipo: inferPostType(file.mimeType, file.name),
      drive_file_id: file.id,
      drive_url: getMediaProxyUrl(file.id, clienteId),
      status: "PENDENTE",
      hashtags: "",
      criado_em: file.createdTime || now,
      atualizado_em: now,
      criado_por_nome: author,
    };
    const created = await createPostRecord(payload);
    await upsertClienteDriveArquivo({
      cliente_id: clienteId || "",
      post_id: created.id,
      drive_file_id: file.id,
      drive_folder_id: folders.entradaId,
      drive_file_name: file.name,
      drive_mime_type: file.mimeType,
      origem: "GOOGLE_DRIVE",
      status: "IMPORTADO",
      raw_payload: file as unknown as Record<string, unknown>,
    });

    await createHistoryRecord({
      cliente_id: created.cliente_id || null,
      post_id: created.id,
      post_titulo: created.titulo,
      usuario: author,
      acao: "Importado do Google Drive",
      observacao: `Arquivo '${file.name}' importado automaticamente da pasta monitorada.`,
      criado_em: now,
    });

    createdPosts.push(created);
  }

  await addLog("Google Drive", "success", "ImportaÃ§Ã£o do Google Drive concluÃ­da.", {
    imported: createdPosts.length,
    folderId: folders.entradaId,
  }, clienteId || undefined);

  return createdPosts;
}

async function runScheduledPublications(): Promise<number> {
  const posts = await listPosts();
  const now = new Date();
  let processed = 0;

  for (const post of posts) {
    if (post.status !== "AGENDADA" || !post.data_agendamento) {
      continue;
    }

    if (new Date(post.data_agendamento) > now) {
      continue;
    }

    processed += 1;
    await createHistoryRecord({
      cliente_id: post.cliente_id || null,
      post_id: post.id,
      post_titulo: post.titulo,
      usuario: "Scheduler",
      acao: "Aprovado",
      observacao: `HorÃ¡rio de agendamento atingido em ${now.toISOString()}.`,
      criado_em: now.toISOString(),
    });

    try {
      await publishPost(post, "Scheduler");
    } catch (error) {
      await updatePostRecord(post.id, {
        status: "ERRO",
        erro_detalhe: maskError(error),
        atualizado_em: new Date().toISOString(),
      });
      await addLog("Scheduler", "error", `Falha ao publicar post agendado '${post.titulo}'.`, {
        postId: post.id,
        error: maskError(error),
      }, post.cliente_id || undefined);
    }
  }

  return processed;
}

function getCurrentUserName(headerValue: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || fallback;
  }
  return headerValue || fallback;
}

function getCurrentUserEmail(headerValue: string | string[] | undefined): string {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || "";
  }
  return headerValue || "";
}

async function getActingUserFromRequest(req: express.Request): Promise<ActingUser> {
  const accessToken = getAuthorizationToken(req.headers.authorization);
  if (accessToken) {
    const authUser = await fetchSupabaseAuthUser(accessToken);
    const operationalUser = await findOperationalUserByAuthIdentity(authUser);

    if (!operationalUser) {
      throw new HttpError(
        403,
        `O usuÃ¡rio autenticado '${authUser.email}' nÃ£o possui cadastro operacional ativo na tabela usuarios.`,
      );
    }

    if (!operationalUser.ativo) {
      throw new HttpError(403, `UsuÃ¡rio '${operationalUser.email}' estÃ¡ inativo.`);
    }

    return toActingUser(operationalUser);
  }

  const requestedEmail = getCurrentUserEmail(req.headers["x-user-email"]).trim().toLowerCase();
  const requestedName = getCurrentUserName(req.headers["x-user-name"], "").trim().toLowerCase();
  if (!requestedEmail && !requestedName) {
    throw new HttpError(401, "AutenticaÃ§Ã£o obrigatÃ³ria.");
  }

  const users = await listUsers();

  let match =
    users.find((user) => requestedEmail && user.email.toLowerCase() === requestedEmail) ||
    users.find((user) => requestedName && user.nome.toLowerCase() === requestedName);

  if (!match) {
    match =
      users.find((user) => user.email.toLowerCase() === "cmourasiga@gmail.com") ||
      users.find((user) => normalizePerfilPublicacao(user) === "ADMIN") ||
      users[0];
  }

  if (!match) {
    throw new Error("Nenhum usuÃ¡rio disponÃ­vel na base de usuÃ¡rios.");
  }

  if (!match.ativo) {
    throw new Error(`UsuÃ¡rio '${match.email}' estÃ¡ inativo.`);
  }

  return toActingUser(match);
}

function canCreatePosts(user: ActingUser): boolean {
  return user.perfil_publicacao === "CRIADOR" || user.perfil_publicacao === "ADMIN" || user.perfil_publicacao === "ADMIN_CLIENTE";
}

function canApprovePosts(user: ActingUser): boolean {
  return user.perfil_publicacao === "APROVADOR" || user.perfil_publicacao === "ADMIN" || user.perfil_publicacao === "ADMIN_CLIENTE";
}

function assertCanCreatePosts(user: ActingUser) {
  if (!canCreatePosts(user)) {
    throw new HttpError(403, `UsuÃ¡rio '${user.email}' nÃ£o possui permissÃ£o para criar publicaÃ§Ãµes.`);
  }
}

function assertCanApprovePosts(user: ActingUser) {
  if (!canApprovePosts(user)) {
    throw new HttpError(403, `UsuÃ¡rio '${user.email}' nÃ£o possui permissÃ£o para aprovar ou publicar.`);
  }
}

function assertIsAdmin(user: ActingUser) {
  if (user.perfil_publicacao !== "ADMIN" && user.perfil_publicacao !== "SUPER_ADMIN") {
    throw new HttpError(403, `UsuÃ¡rio '${user.email}' nÃ£o possui permissÃ£o administrativa.`);
  }
}

function canEditClientSettings(user: ActingUser): boolean {
  return user.perfil_publicacao === "SUPER_ADMIN" || user.perfil_publicacao === "ADMIN" || user.perfil_publicacao === "ADMIN_CLIENTE";
}

function assertCanManageGoogleDrive(user: ActingUser) {
  if (user.perfil_publicacao !== "SUPER_ADMIN" && user.perfil_publicacao !== "ADMIN") {
    throw new HttpError(403, `UsuÃ¡rio '${user.email}' nÃ£o possui permissÃ£o para gerenciar Google Drive.`);
  }
}

function assertCanManageInstagram(user: ActingUser) {
  if (user.perfil_publicacao !== "SUPER_ADMIN" && user.perfil_publicacao !== "ADMIN") {
    throw new HttpError(403, `UsuÃ¡rio '${user.email}' nÃ£o possui permissÃ£o para gerenciar Instagram/Meta.`);
  }
}

async function getPostInsightResumo(postId: string): Promise<PostInsightResumo | null> {
  if (!(await canUseSupabase())) {
    return memoryStore.postInsightsResumo.find((item) => item.post_id === postId) || null;
  }
  try {
    const items = await supabaseRequest<PostInsightResumo[]>(`post_insights_resumo?post_id=eq.${sanitizeId(postId)}&select=*`);
    return items[0] || null;
  } catch {
    return memoryStore.postInsightsResumo.find((item) => item.post_id === postId) || null;
  }
}

async function upsertPostInsightResumo(
  payload: Omit<PostInsightResumo, "id"> & { id?: string },
): Promise<PostInsightResumo> {
  const current = await getPostInsightResumo(payload.post_id);
  const record: PostInsightResumo = {
    id: payload.id || current?.id || randomUUID(),
    ...current,
    ...payload,
  };
  if (!(await canUseSupabase())) {
    const index = memoryStore.postInsightsResumo.findIndex((item) => item.post_id === payload.post_id);
    if (index >= 0) memoryStore.postInsightsResumo[index] = record;
    else memoryStore.postInsightsResumo.unshift(record);
    return record;
  }
  const existing = await supabaseRequest<PostInsightResumo[]>(
    `post_insights_resumo?post_id=eq.${sanitizeId(payload.post_id)}&select=*`,
  ).catch(() => []);
  const result = existing.length
    ? await supabaseRequest<PostInsightResumo[]>(
        `post_insights_resumo?post_id=eq.${sanitizeId(payload.post_id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(record),
        },
      )
    : await supabaseRequest<PostInsightResumo[]>("post_insights_resumo", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(record),
      });
  return result[0] || record;
}

function getGoogleOauthMissingEnv(config = getRuntimeConfig()): string[] {
  return [
    !config.googleClientId ? "GOOGLE_CLIENT_ID" : "",
    !config.googleClientSecret ? "GOOGLE_CLIENT_SECRET" : "",
    !config.googleRedirectUri ? "GOOGLE_DRIVE_REDIRECT_URI/GOOGLE_REDIRECT_URI" : "",
  ].filter(Boolean);
}

function getInstagramOauthMissingEnv(config = getRuntimeConfig()): string[] {
  return [
    !config.instagramAppId ? "INSTAGRAM_APP_ID" : "",
    !config.instagramAppSecret ? "INSTAGRAM_APP_SECRET" : "",
    !config.instagramRedirectUri ? "INSTAGRAM_REDIRECT_URI" : "",
  ].filter(Boolean);
}

function getMetaOauthMissingEnv(config = getRuntimeConfig()): string[] {
  return [
    !config.metaAppId ? "META_APP_ID" : "",
    !config.metaAppSecret ? "META_APP_SECRET" : "",
    !config.metaRedirectUri ? "META_REDIRECT_URI" : "",
  ].filter(Boolean);
}

async function buildInstagramAuthorizationUrl(input: {
  clienteId: string;
  usuarioId?: string | null;
  provider: "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
  returnTo?: string | null;
}): Promise<string> {
  const config = getRuntimeConfig();
  const missing =
    input.provider === "INSTAGRAM_LOGIN" ? getInstagramOauthMissingEnv(config) : getMetaOauthMissingEnv(config);
  if (missing.length > 0) {
    throw new HttpError(400, `Faltam credenciais globais do OAuth da Meta/Instagram: ${missing.join(", ")}.`);
  }

  const stateValue = randomBytes(24).toString("hex");
  await createInstagramOauthState({
    state: stateValue,
    cliente_id: input.clienteId,
    usuario_id: input.usuarioId || null,
    provider: input.provider,
    redirect_after_success: input.returnTo || null,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  const url =
    input.provider === "INSTAGRAM_LOGIN"
      ? new URL("https://api.instagram.com/oauth/authorize")
      : new URL("https://www.facebook.com/v25.0/dialog/oauth");
  const clientId = input.provider === "INSTAGRAM_LOGIN" ? config.instagramAppId : config.metaAppId;
  const redirectUri = input.provider === "INSTAGRAM_LOGIN" ? config.instagramRedirectUri : config.metaRedirectUri;
  const scope =
    input.provider === "INSTAGRAM_LOGIN"
      ? "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights"
      : "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish,instagram_manage_insights";

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", stateValue);
  return url.toString();
}

async function buildGoogleDriveAuthorizationUrl(input: {
  clienteId: string;
  usuarioId?: string | null;
  returnTo?: string | null;
}): Promise<string> {
  const config = getRuntimeConfig();
  const missing = getGoogleOauthMissingEnv(config);
  if (missing.length > 0) {
    throw new HttpError(400, `Faltam credenciais globais do app OAuth do Google: ${missing.join(", ")}.`);
  }

  const stateValue = randomBytes(24).toString("hex");
  await createGoogleDriveOauthState({
    state: stateValue,
    cliente_id: input.clienteId,
    usuario_id: input.usuarioId || null,
    redirect_after_success: input.returnTo || null,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.googleClientId);
  url.searchParams.set("redirect_uri", config.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/drive");
  url.searchParams.set("state", stateValue);
  return url.toString();
}

async function applyGoogleDriveRootFolder(
  clienteId: string,
  rootFolderId: string,
  actingUser: ActingUser,
): Promise<ClienteIntegracao | null> {
  const normalizedRoot = extractGoogleDriveFolderId(rootFolderId);
  if (!normalizedRoot) {
    throw new HttpError(400, "Informe um ID ou link de pasta do Google Drive vÃ¡lido.");
  }

  const folder = await testDriveFolderAccessForClient(clienteId, normalizedRoot);
  const integration = await updateClienteIntegracaoRecord(clienteId, {
    google_drive_folder_id: folder.id,
    google_drive_last_error: null,
  });
  await setClienteGoogleDriveStatus(clienteId, "CONECTADO", {
    connectedAt: new Date().toISOString(),
    lastError: "",
  });
  await createParametroAuditoria({
    escopo: "INTEGRACAO",
    cliente_id: clienteId,
    usuario_id: actingUser.id,
    chave: "GOOGLE_DRIVE_FOLDER_ID",
    categoria: "INTEGRACAO",
    valor_anterior_mascarado: null,
    valor_novo_mascarado: folder.id,
    acao: "ALTERADO",
    origem: "WEBAPP",
  });
  return integration;
}

function parseBody<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

function respondWithError(
  res: express.Response,
  error: unknown,
  service: LogMessage["service"],
  message: string,
  status = 500,
) {
  const detail = maskError(error);
  const resolvedStatus = error instanceof HttpError ? error.status : status;
  void addLog(service, "error", message, { error: detail });
  res.status(resolvedStatus).json({ success: false, error: detail });
}

app.get("/api/posts", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const clienteId = await resolveClienteIdFromRequest(req);
    res.json({ posts: await listPosts(clienteId), clienteId });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar posts.");
  }
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const clienteId = await resolveClienteIdFromRequest(req);
    const post = await getPostById(req.params.id, clienteId);
    if (!post) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }
    res.json({ post });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao buscar post.");
  }
});

app.post("/api/posts", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanCreatePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const now = new Date().toISOString();
    const payload: Omit<Post, "id"> = {
      cliente_id: clienteId,
      titulo: parseBody(req.body.titulo, "Sem TÃ­tulo"),
      legenda: parseBody(req.body.legenda, ""),
      tipo: normalizePostTypeInput(req.body.tipo, req.body.filename),
      drive_file_id: req.body.drive_file_id || undefined,
      drive_url: req.body.drive_url || undefined,
      status: parseBody(req.body.status, "RASCUNHO"),
      hashtags: parseBody(req.body.hashtags, ""),
      criado_em: now,
      atualizado_em: now,
      criado_por_nome: actingUser.nome,
      media_validation_status: req.body.media_validation_status ?? null,
      media_validation_errors: req.body.media_validation_errors ?? [],
      media_validation_warnings: req.body.media_validation_warnings ?? [],
      media_metadata: req.body.media_metadata ?? undefined,
      video_original_drive_file_id: req.body.video_original_drive_file_id ?? null,
      video_original_drive_url: req.body.video_original_drive_url ?? null,
      video_editado_drive_file_id: req.body.video_editado_drive_file_id ?? null,
      video_editado_drive_url: req.body.video_editado_drive_url ?? null,
      trim_start_sec: req.body.trim_start_sec ?? null,
      trim_end_sec: req.body.trim_end_sec ?? null,
      video_original_duration_sec: req.body.video_original_duration_sec ?? null,
      video_final_duration_sec: req.body.video_final_duration_sec ?? null,
      thumbnail_drive_file_id: req.body.thumbnail_drive_file_id ?? null,
      thumbnail_drive_url: req.body.thumbnail_drive_url ?? null,
      thumbnail_time_sec: req.body.thumbnail_time_sec ?? null,
      video_edit_metadata: req.body.video_edit_metadata ?? undefined,
    };
    assertVideoPostCanAdvance(payload);
    const created = await createPostRecord(payload);

    await createHistoryRecord({
      cliente_id: clienteId,
      post_id: created.id,
      post_titulo: created.titulo,
      usuario: actingUser.nome,
      acao: created.status === "PENDENTE" ? "Envio para AprovaÃ§Ã£o" : "CriaÃ§Ã£o de Post",
      observacao:
        created.status === "PENDENTE"
          ? "Post criado com mÃ­dia vinculada e enviado para aprovaÃ§Ã£o."
          : "Post salvo como rascunho.",
      criado_em: now,
    });

    await addLog("Database", "success", `Novo post '${created.titulo}' persistido.`, {
      clienteId,
      postId: created.id,
      status: created.status,
    });

    res.status(201).json({ success: true, post: created });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao criar post.");
  }
});

app.put("/api/posts/:id", async (req, res) => {
  try {
    const clienteId = await resolveClienteIdFromRequest(req);
    const existing = await getPostById(req.params.id, clienteId);
    if (!existing) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }

    const actingUser = await getActingUserFromRequest(req);
    assertCanCreatePosts(actingUser);
    const patch: Partial<Post> = {
      titulo: req.body.titulo ?? existing.titulo,
      legenda: req.body.legenda ?? existing.legenda,
      hashtags: req.body.hashtags ?? existing.hashtags,
      tipo: req.body.tipo ? normalizePostTypeInput(req.body.tipo, req.body.filename || existing.titulo) : existing.tipo,
      drive_url: req.body.drive_url ?? existing.drive_url,
      drive_file_id: req.body.drive_file_id ?? existing.drive_file_id,
      data_agendamento: req.body.data_agendamento ?? existing.data_agendamento,
      status: req.body.status ?? existing.status,
      atualizado_em: new Date().toISOString(),
      erro_detalhe: req.body.erro_detalhe ?? existing.erro_detalhe,
      media_validation_status: req.body.media_validation_status ?? existing.media_validation_status,
      media_validation_errors: req.body.media_validation_errors ?? existing.media_validation_errors,
      media_validation_warnings: req.body.media_validation_warnings ?? existing.media_validation_warnings,
      media_metadata: req.body.media_metadata ?? existing.media_metadata,
      video_original_drive_file_id: req.body.video_original_drive_file_id ?? existing.video_original_drive_file_id,
      video_original_drive_url: req.body.video_original_drive_url ?? existing.video_original_drive_url,
      video_editado_drive_file_id: req.body.video_editado_drive_file_id ?? existing.video_editado_drive_file_id,
      video_editado_drive_url: req.body.video_editado_drive_url ?? existing.video_editado_drive_url,
      trim_start_sec: req.body.trim_start_sec ?? existing.trim_start_sec,
      trim_end_sec: req.body.trim_end_sec ?? existing.trim_end_sec,
      video_original_duration_sec: req.body.video_original_duration_sec ?? existing.video_original_duration_sec,
      video_final_duration_sec: req.body.video_final_duration_sec ?? existing.video_final_duration_sec,
      thumbnail_drive_file_id: req.body.thumbnail_drive_file_id ?? existing.thumbnail_drive_file_id,
      thumbnail_drive_url: req.body.thumbnail_drive_url ?? existing.thumbnail_drive_url,
      thumbnail_time_sec: req.body.thumbnail_time_sec ?? existing.thumbnail_time_sec,
      video_edit_metadata: req.body.video_edit_metadata ?? existing.video_edit_metadata,
      cliente_id: clienteId,
    };
    assertVideoPostCanAdvance({
      tipo: patch.tipo,
      status: patch.status,
      media_validation_status: patch.media_validation_status,
    });
    const next = await updatePostRecord(req.params.id, patch);

    await createHistoryRecord({
      cliente_id: clienteId,
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "EdiÃ§Ã£o de Post",
      observacao: "Campos do post atualizados no painel.",
      criado_em: new Date().toISOString(),
    });

    await addLog("Database", "info", `Post '${next.titulo}' atualizado.`, {
      postId: next.id,
    });

    res.json({ success: true, post: next });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao atualizar post.");
  }
});

app.delete("/api/posts/:id", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanCreatePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const deleted = await deletePostRecord(req.params.id, clienteId);
    if (!deleted) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }

    await addLog("Database", "warn", `Post '${deleted.titulo}' removido.`, {
      postId: deleted.id,
      postTitle: deleted.titulo,
      actor: actingUser.nome,
      action: "RemoÃ§Ã£o de Post",
    });

    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao remover post.");
  }
});

app.post("/api/posts/:id/submit", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanCreatePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const post = await getPostById(req.params.id, clienteId);
    if (!post) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }

    assertVideoPostCanAdvance({
      tipo: post.tipo,
      status: "PENDENTE",
      media_validation_status: post.media_validation_status,
    });

    const next = await updatePostRecord(req.params.id, {
      cliente_id: clienteId,
      status: "PENDENTE",
      atualizado_em: new Date().toISOString(),
      erro_detalhe: undefined,
    });

    await createHistoryRecord({
      cliente_id: clienteId,
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Envio para AprovaÃ§Ã£o",
      observacao: "Post encaminhado para moderaÃ§Ã£o.",
      criado_em: new Date().toISOString(),
    });

    res.json({ success: true, post: next });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao enviar post para aprovaÃ§Ã£o.");
  }
});

app.post("/api/posts/:id/reject", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const post = await getPostById(req.params.id, clienteId);
    if (!post) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }

    const next = await updatePostRecord(req.params.id, {
      cliente_id: clienteId,
      status: "REJEITADA",
      atualizado_em: new Date().toISOString(),
      erro_detalhe: undefined,
    });

    await createHistoryRecord({
      cliente_id: clienteId,
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Rejeitado",
      observacao: req.body.feedback || "Post rejeitado para ajustes editoriais.",
      criado_em: new Date().toISOString(),
    });

    await addLog("Scheduler", "warn", `Post '${next.titulo}' rejeitado.`, {
      postId: next.id,
      feedback: req.body.feedback || "",
    });

    res.json({ success: true, post: next });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao rejeitar post.");
  }
});

app.post("/api/posts/:id/approve", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const post = await getPostById(req.params.id, clienteId);
    if (!post) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }

    const action = req.body.action === "schedule" ? "schedule" : "instant";
    const mediaValidation = assertPostMediaValidation(req.body.mediaValidation, post);
    const effectivePost =
      mediaValidation.resolvedTipo !== post.tipo
        ? await updatePostRecord(req.params.id, {
            tipo: mediaValidation.resolvedTipo,
            atualizado_em: new Date().toISOString(),
          })
        : post;

    if (action === "schedule") {
      const appointmentTime = req.body.appointmentTime;
      if (!appointmentTime) {
        return res.status(400).json({ error: "appointmentTime Ã© obrigatÃ³rio para agendamento." });
      }

      const next = await updatePostRecord(req.params.id, {
        status: "AGENDADA",
        data_agendamento: appointmentTime,
        atualizado_em: new Date().toISOString(),
        erro_detalhe: undefined,
      });

      await createHistoryRecord({
        cliente_id: clienteId,
        post_id: next.id,
        post_titulo: next.titulo,
        usuario: actingUser.nome,
        acao: "Agendado",
        observacao: `Post agendado para ${appointmentTime}.`,
        criado_em: new Date().toISOString(),
      });

      await addLog("Scheduler", "info", `Post '${next.titulo}' agendado.`, {
        postId: next.id,
        appointmentTime,
      }, clienteId);

      return res.json({ success: true, post: next });
    }

    await createHistoryRecord({
      cliente_id: clienteId,
      post_id: post.id,
      post_titulo: post.titulo,
      usuario: actingUser.nome,
      acao: "Aprovado",
      observacao: "AprovaÃ§Ã£o concedida para publicaÃ§Ã£o imediata.",
      criado_em: new Date().toISOString(),
    });

    const published = await publishPost(effectivePost, actingUser.nome);
    res.json({ success: true, post: published });
  } catch (error) {
    if (req.params.id) {
      try {
        const clienteId = await resolveClienteIdFromRequest(req);
        const currentPost = await getPostById(req.params.id, clienteId);
        await restorePostToModerationAfterPublishFailure(
          req.params.id,
          clienteId,
          error,
          currentPost?.titulo,
          currentPost?.criado_por_nome,
        );
      } catch {
        // Ignore secondary failure.
      }
    }
    respondWithError(res, error, "Instagram API", "Falha ao aprovar/publicar post.");
  }
});

app.post("/api/posts/aprovar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const post = await getPostById(req.body.id, clienteId);
    if (!post) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }

    const action = req.body.action === "schedule" ? "schedule" : "instant";
    const mediaValidation = assertPostMediaValidation(req.body.mediaValidation, post);
    const effectivePost =
      mediaValidation.resolvedTipo !== post.tipo
        ? await updatePostRecord(post.id, {
            tipo: mediaValidation.resolvedTipo,
            atualizado_em: new Date().toISOString(),
          })
        : post;

    if (action === "schedule") {
      const appointmentTime = req.body.appointmentTime;
      if (!appointmentTime) {
        return res.status(400).json({ error: "appointmentTime Ã© obrigatÃ³rio para agendamento." });
      }

      const next = await updatePostRecord(post.id, {
        status: "AGENDADA",
        data_agendamento: appointmentTime,
        atualizado_em: new Date().toISOString(),
        erro_detalhe: undefined,
      });

      await createHistoryRecord({
        cliente_id: clienteId,
        post_id: next.id,
        post_titulo: next.titulo,
        usuario: actingUser.nome,
        acao: "Agendado",
        observacao: `Post agendado para ${appointmentTime}.`,
        criado_em: new Date().toISOString(),
      });

      return res.json({ success: true, post: next });
    }

    const published = await publishPost(effectivePost, actingUser.nome);
    return res.json({ success: true, post: published });
  } catch (error) {
    if (req.body?.id) {
      try {
        const clienteId = await resolveClienteIdFromRequest(req);
        const currentPost = await getPostById(req.body.id, clienteId);
        await restorePostToModerationAfterPublishFailure(
          req.body.id,
          clienteId,
          error,
          currentPost?.titulo,
          currentPost?.criado_por_nome,
        );
      } catch {
        // Ignore secondary failure.
      }
    }
    respondWithError(res, error, "Instagram API", "Falha ao aprovar/publicar post.");
  }
});

app.post("/api/posts/rejeitar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const post = await getPostById(req.body.id, clienteId);
    if (!post) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }

    const next = await updatePostRecord(post.id, {
      status: "REJEITADA",
      atualizado_em: new Date().toISOString(),
      erro_detalhe: undefined,
      cliente_id: clienteId,
    });

    await createHistoryRecord({
      cliente_id: clienteId,
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Rejeitado",
      observacao: req.body.feedback || "Post rejeitado para ajustes editoriais.",
      criado_em: new Date().toISOString(),
    });

    return res.json({ success: true, post: next });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao rejeitar post.");
  }
});

app.post("/api/posts/publicar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const post = await getPostById(req.body.id, clienteId);
    if (!post) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }
    const published = await publishPost(post, actingUser.nome);
    res.json({ success: true, post: published });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao publicar post.");
  }
});

async function handleDriveUpload(req: express.Request, res: express.Response) {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (!canCreatePosts(actingUser) && !canApprovePosts(actingUser)) {
      throw new HttpError(403, `UsuÃ¡rio '${actingUser.email}' nÃ£o possui permissÃ£o para enviar mÃ­dias.`);
    }
    const filename = trimEnv(req.body.filename) || `upload-${Date.now()}`;
    const dataUrl = trimEnv(req.body.base64Data);
    const explicitMimeType = trimEnv(req.body.type) || "application/octet-stream";
    const inferredType = inferPostType(explicitMimeType, filename);

    if (!dataUrl) {
      return res.status(400).json({ error: "base64Data Ã© obrigatÃ³rio." });
    }
    if (inferredType === "VIDEO" && !ACCEPTED_VIDEO_UPLOAD_MIME_TYPES.has(explicitMimeType)) {
      return res.status(400).json({ error: "Formato de video nao suportado para este fluxo. Use MP4, MOV ou M4V." });
    }
    const declaredSizeBytes = typeof req.body.sizeBytes === "number" ? req.body.sizeBytes : Number(req.body.sizeBytes);
    if (inferredType === "VIDEO" && Number.isFinite(declaredSizeBytes) && declaredSizeBytes > MAX_INLINE_VIDEO_UPLOAD_BYTES) {
      return res.status(400).json({ error: "O video ultrapassa o limite seguro de 45 MB para o upload atual." });
    }

    const parsed = dataUrlToBuffer(dataUrl);
    const mimeType = parsed.mimeType || explicitMimeType;
    const clienteId = await resolveClienteIdFromRequest(req);

    await addLog("Google Drive", "info", `Recebido upload de '${filename}'.`, {
      filename,
      mimeType,
      sizeBytes: req.body.sizeBytes,
      mode: (await getSettingsView(clienteId)).operationalMode,
    }, clienteId);

    if (!(await canUseRealMode(clienteId))) {
      return res.json({
        success: true,
        fileId: `sandbox_${randomUUID()}`,
        url: dataUrl,
        filename,
        folder: inferPostType(mimeType, filename) === "IMAGEM" ? "Imagens" : "Videos",
        mode: "SIMULATOR",
      });
    }

    const uploaded = await uploadFileToGoogleDrive({
      filename,
      mimeType,
      buffer: parsed.buffer,
    }, clienteId);

    await addLog("Google Drive", "success", `Upload concluÃ­do para '${filename}'.`, {
      fileId: uploaded.fileId,
      folder: uploaded.folderName,
      publicUrl: uploaded.url,
    });

    res.json({
      success: true,
      fileId: uploaded.fileId,
      url: uploaded.url,
      filename,
      folder: uploaded.folderName,
      mode: "REAL",
    });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha no upload ao Google Drive.");
  }
}

app.post("/api/posts/:id/media", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const existing = await getPostById(req.params.id, clienteId);
    if (!existing) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }

    const next = await updatePostRecord(req.params.id, {
      cliente_id: clienteId,
      drive_url: req.body.drive_url || existing.drive_url,
      drive_file_id: req.body.drive_file_id || existing.drive_file_id,
      tipo: normalizePostTypeInput(req.body.tipo, req.body.filename || existing.titulo),
      atualizado_em: new Date().toISOString(),
      erro_detalhe: undefined,
    });

    await createHistoryRecord({
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Troca de MÃ­dia",
      observacao: "MÃ­dia atualizada na etapa de moderaÃ§Ã£o.",
      criado_em: new Date().toISOString(),
    });

    await addLog("Database", "info", `MÃ­dia do post '${next.titulo}' atualizada na moderaÃ§Ã£o.`, {
      postId: next.id,
      driveFileId: next.drive_file_id,
    }, clienteId);

    return res.json({ success: true, post: next });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao atualizar a mÃ­dia do post.");
  }
});

app.post("/api/google/upload", handleDriveUpload);
app.post("/api/simulate-drive-upload", handleDriveUpload);

app.get("/api/media/:fileId", async (req, res) => {
  try {
    if (!verifyMediaSignature(req.params.fileId, String(req.query.signature || ""))) {
      return res.status(403).json({ error: "Assinatura de mÃ­dia invÃ¡lida." });
    }

    const clienteId = await resolveClienteIdFromRequest(req);
    if (!(await canUseRealMode(clienteId))) {
      return res.status(404).json({ error: "MÃ­dia nÃ£o disponÃ­vel fora do modo real." });
    }

    const accessToken = await getGoogleAccessToken(clienteId);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao servir mÃ­dia do Google Drive.", 502);
  }
});

app.get("/api/google/oauth/start", async (req, res) => {
  try {
    const clienteId = trimEnv(String(req.query.cliente_id || ""));
    const returnTo = trimEnv(String(req.query.return_to || "/"));
    const url = await buildGoogleDriveAuthorizationUrl({ clienteId, returnTo });
    res.redirect(url);
  } catch (error) {
    const missing = getGoogleOauthMissingEnv();
    const wantsJson =
      String(req.query.format || "").toLowerCase() === "json" ||
      String(req.headers.accept || "").includes("application/json");
    const message = error instanceof Error ? error.message : "Falha ao iniciar OAuth do Google.";
    if (wantsJson) {
      return res.status(error instanceof HttpError ? error.status : 400).json({ error: message, missing });
    }
    return res
      .status(error instanceof HttpError ? error.status : 400)
      .send(
        renderSimpleHtmlPage(
          "Google OAuth indisponivel",
          `<p>${escapeHtml(message)}</p>
           <div class="box">
             <strong>O que configurar no ambiente</strong>
             <pre><code>GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_REDIRECT_URI=</code></pre>
           </div>
           <div class="box">
             <strong>Redirect URI local sugerida</strong>
             <p><code>http://localhost:3000/api/integrations/google-drive/callback</code></p>
           </div>`,
        ),
      );
  }
});

app.post("/api/clientes/:clienteId/posts/:postId/publicar-instagram", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const post = await getPostById(req.params.postId, req.params.clienteId);
    if (!post) {
      return res.status(404).json({ error: "Post nÃ£o encontrado." });
    }
    const published = await publishPost(post, actingUser.nome);
    res.json({ success: true, post: published });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao publicar post no Instagram.", 400);
  }
});

app.post("/api/clientes/:clienteId/posts/:postId/insights/sync", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (!canEditClientSettings(actingUser) && !canApprovePosts(actingUser)) {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para sincronizar insights.");
    }
    const resumo = await syncInstagramPostInsights(req.params.clienteId, req.params.postId);
    res.json({ success: true, insight: resumo });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao sincronizar insights do post.", 400);
  }
});

app.get("/api/clientes/:clienteId/posts/:postId/insights", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const post = await getPostById(req.params.postId, req.params.clienteId);
    if (!post) return res.status(404).json({ error: "Post nÃ£o encontrado." });
    const insight = await getPostInsightResumo(req.params.postId);
    res.json({ insight });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao carregar insights do post.", 400);
  }
});

app.get("/api/clientes/:clienteId/insights/dashboard", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const posts = await listPosts(req.params.clienteId);
    const insights = await Promise.all(posts.map((post) => getPostInsightResumo(post.id)));
    const items = insights.filter(Boolean) as PostInsightResumo[];
    const totals = items.reduce(
      (acc, item) => {
        acc.views += Number(item.views || 0);
        acc.reach += Number(item.reach || 0);
        acc.likes += Number(item.likes || 0);
        acc.comments += Number(item.comments || 0);
        acc.shares += Number(item.shares || 0);
        acc.saved += Number(item.saved || 0);
        acc.total_interactions += Number(item.total_interactions || 0);
        return acc;
      },
      { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saved: 0, total_interactions: 0 },
    );
    res.json({ items, totals, count: items.length });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao carregar dashboard de insights.", 400);
  }
});

app.get("/api/google/oauth/status", async (_req, res) => {
  const config = getRuntimeConfig();
  const missing = getGoogleOauthMissingEnv(config);
  res.json({
    ready: missing.length === 0,
    missing,
    redirectUri: config.googleRedirectUri,
  });
});

app.get("/api/google/oauth/callback", async (req, res) => {
  const params = new URLSearchParams(req.query as Record<string, string>).toString();
  res.redirect(`/api/integrations/google-drive/callback${params ? `?${params}` : ""}`);
});

app.get("/api/integrations/google-drive/callback", async (req, res) => {
  try {
    const config = getRuntimeConfig();
    const code = trimEnv(String(req.query.code || ""));
    const stateValue = trimEnv(String(req.query.state || ""));
    const state = await getGoogleDriveOauthState(stateValue);
    if (!code) {
      return res.status(400).json({ error: "ParÃ¢metro code ausente." });
    }
    if (!state) {
      return res.status(400).json({ error: "State OAuth do Google invÃ¡lido ou expirado." });
    }
    if (state.used_at) {
      return res.status(400).json({ error: "State OAuth do Google jÃ¡ utilizado." });
    }
    if (new Date(state.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "State OAuth do Google expirado." });
    }
    if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
      return res.status(400).json({ error: "Credenciais OAuth do Google incompletas." });
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const tokens = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    const refreshToken = tokens.refresh_token || "";
    let googleAccountEmail = "";
    if (tokens.access_token) {
      try {
        const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });
        if (profileResponse.ok) {
          const profile = (await profileResponse.json()) as { email?: string };
          googleAccountEmail = trimEnv(profile.email);
        }
      } catch {
        googleAccountEmail = "";
      }
    }

    if (state.cliente_id) {
      await ensureClienteSetup(state.cliente_id);
      await setClienteGoogleDriveStatus(
        state.cliente_id,
        refreshToken ? "CONECTADO" : "ERRO",
        {
          token: refreshToken || undefined,
          accountEmail: googleAccountEmail,
          connectedAt: new Date().toISOString(),
          lastError: refreshToken ? "" : "Google nÃ£o retornou refresh_token nesta concessÃ£o.",
        },
      );
      await markGoogleDriveOauthStateUsed(state.id, stateValue);
    }

    const envSnippet = [
      `GOOGLE_CLIENT_ID=${config.googleClientId}`,
      `GOOGLE_CLIENT_SECRET=${config.googleClientSecret}`,
      `GOOGLE_REFRESH_TOKEN=${refreshToken}`,
      `GOOGLE_DRIVE_REDIRECT_URI=${config.googleRedirectUri}`,
    ].join("\n");

    const payload = {
      success: true,
      message: state.cliente_id
        ? refreshToken
          ? "Conta Google conectada ao cliente com sucesso."
          : "O login Google concluiu, mas o refresh_token nao foi retornado. Revogue o acesso e repita a conexao."
        : refreshToken
          ? "Callback Google concluÃ­do. Salve o refresh_token nas variÃ¡veis de ambiente."
          : "Callback Google concluÃ­do, mas o Google nÃ£o retornou refresh_token. Revogue o acesso do app e repita com prompt=consent.",
      refreshToken,
      googleAccountEmail,
      clienteId: state.cliente_id || "",
      envSnippet,
      tokens,
    };
    const wantsJson =
      String(req.query.format || "").toLowerCase() === "json" ||
      String(req.headers.accept || "").includes("application/json");

    if (wantsJson) {
      return res.json(payload);
    }

    return res.status(200).send(
      renderOauthPopupResultPage("Google OAuth concluÃ­do", payload.message, {
        type: "instaflow-google-oauth",
        ...payload,
      }),
    );
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha no callback OAuth do Google.");
  }
});

app.post("/api/google/import", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanCreatePosts(actingUser);
    const clienteId = await resolveClienteIdFromRequest(req);
    const imported = await importGoogleDrivePosts(actingUser.nome, clienteId);
    res.json({
      success: true,
      importedCount: imported.length,
      posts: imported,
    });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao importar arquivos do Google Drive.");
  }
});

app.get("/api/meta/oauth/start", (_req, res) => {
  const config = getRuntimeConfig();
  if (!config.metaAppId || !config.metaRedirectUri) {
    return res.status(400).json({ error: "META_APP_ID e META_REDIRECT_URI sÃ£o obrigatÃ³rios." });
  }

  const url = new URL(`https://www.facebook.com/${config.graphApiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", config.metaAppId);
  url.searchParams.set("redirect_uri", config.metaRedirectUri);
  url.searchParams.set(
    "scope",
    "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management",
  );

  res.redirect(url.toString());
});

app.get("/api/meta/oauth/callback", async (req, res) => {
  try {
    const config = getRuntimeConfig();
    const code = trimEnv(String(req.query.code || ""));
    if (!code) {
      return res.status(400).json({ error: "ParÃ¢metro code ausente." });
    }
    if (!config.metaAppId || !config.metaAppSecret || !config.metaRedirectUri) {
      return res.status(400).json({ error: "Credenciais OAuth da Meta incompletas." });
    }

    const shortLived = await metaGraphRequest<{ access_token: string }>(`/oauth/access_token?${new URLSearchParams({
      client_id: config.metaAppId,
      client_secret: config.metaAppSecret,
      redirect_uri: config.metaRedirectUri,
      code,
    }).toString()}`);

    const longLived = await metaGraphRequest<{ access_token: string }>(`/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: config.metaAppId,
      client_secret: config.metaAppSecret,
      fb_exchange_token: shortLived.access_token,
    }).toString()}`);

    const pages = await metaGraphRequest<{
      data?: Array<{ id: string; name: string }>;
    }>(`/me/accounts?access_token=${encodeURIComponent(longLived.access_token)}`);

    const pageId = pages.data?.[0]?.id || "";
    let instagramBusinessId = "";

    if (pageId) {
      const igAccount = await metaGraphRequest<{
        instagram_business_account?: { id: string };
      }>(
        `/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(longLived.access_token)}`,
      );
      instagramBusinessId = igAccount.instagram_business_account?.id || "";
    }

    res.json({
      success: true,
      message: "Callback Meta concluÃ­do. Salve os valores abaixo no ambiente da aplicaÃ§Ã£o.",
      accessToken: longLived.access_token,
      facebookPageId: pageId,
      instagramBusinessId,
    });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha no callback OAuth da Meta.");
  }
});

app.get("/api/meta/webhook", (req, res) => {
  const config = getRuntimeConfig();
  const mode = String(req.query["hub.mode"] || "");
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = String(req.query["hub.challenge"] || "");

  if (mode === "subscribe" && token && token === config.metaVerifyToken) {
    return res.status(200).send(challenge);
  }

  res.status(403).send("Forbidden");
});

app.post("/api/meta/webhook", async (req, res) => {
  await addLog("Instagram API", "info", "Webhook da Meta recebido.", req.body);
  res.status(200).json({ received: true });
});

app.post("/api/simulate-tick", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const processedCount = await runScheduledPublications();
    res.json({ success: true, processedCount });
  } catch (error) {
    respondWithError(res, error, "Scheduler", "Falha ao processar publicaÃ§Ãµes agendadas.");
  }
});

app.get("/api/history", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const clienteId = await resolveClienteIdFromRequest(req);
    res.json({ history: await listHistory(clienteId), clienteId });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar histÃ³rico.");
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const clienteId = await resolveClienteIdFromRequest(req);
    res.json({ logs: await listLogs(clienteId), clienteId });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar logs.");
  }
});

app.post("/api/logs/clear", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const clienteId = await resolveClienteIdFromRequest(req);
    await clearLogRecords(clienteId);
    await addLog("Database", "info", "Logs limpos pelo painel.", undefined, clienteId);
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao limpar logs.");
  }
});

app.get("/api/public-config", (_req, res) => {
  try {
    res.json({ config: getPublicRuntimeConfig() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao carregar configuraÃ§Ã£o pÃºblica.", 500);
  }
});

app.get("/api/admin/dashboard", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);

    const clientes = await listClientes();
    const posts = await listPosts();
    const logs = await listLogs();
    const history = await listHistory();

    const clientesAtivos = clientes.filter((cliente) => cliente.status === "ATIVO").length;
    const postsPendentes = posts.filter((post) => post.status === "PENDENTE" || post.status === "PENDENTE_APROVACAO").length;
    const publicacoesMes = posts.filter((post) => {
      const baseDate = post.data_publicacao || post.criado_em;
      if (!baseDate) return false;
      const date = new Date(baseDate);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && /PUBLICAD|AGENDAD/.test(post.status);
    }).length;
    const erros24h = logs.filter((log) => {
      const created = new Date(log.timestamp);
      return log.type === "error" && Date.now() - created.getTime() <= 24 * 60 * 60 * 1000;
    }).length;
    const integracoesComProblema = (await listParametroAuditoria()).filter((item) => item.acao === "TESTADO").length > 0 ? 0 : 0;

    const atividadeRecente = history.slice(0, 10).map((item) => ({
      cliente_id: item.cliente_id || null,
      cliente_nome: clientes.find((cliente) => cliente.id === item.cliente_id)?.nome || "Cliente",
      conteudo: item.post_titulo || item.observacao || item.acao,
      status: item.acao.includes("Aprov") ? "APROVADO" : item.acao.includes("Rejeit") ? "REJEITADO" : "PENDENTE_APROVACAO",
      data: item.criado_em,
    }));

    res.json({
      clientes_ativos: clientesAtivos,
      posts_pendentes: postsPendentes,
      publicacoes_mes: publicacoesMes,
      taxa_sucesso: logs.length ? Math.max(0, Math.min(100, 100 - (erros24h / logs.length) * 100)) : 100,
      erros_24h: erros24h,
      integracoes_com_problema: integracoesComProblema,
      atividade_recente: atividadeRecente,
    });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao carregar dashboard global.");
  }
});

app.get("/api/admin/clientes", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    res.json({ clientes: await listClientes() });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao listar clientes.");
  }
});

app.get("/api/clientes", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const clientes = await listClientes();
    res.json({ clientes });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao listar clientes.");
  }
});

app.get("/api/clientes/:clienteId", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    }
    res.json({ cliente });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao buscar cliente.");
  }
});

app.patch("/api/clientes/:clienteId", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (!canEditClientSettings(actingUser)) {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para editar dados do cliente.");
    }

    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    }

    const payload: Cliente = {
      ...cliente,
      nome: req.body.nome !== undefined ? trimEnv(String(req.body.nome)) : cliente.nome,
      slug: req.body.slug !== undefined ? trimEnv(String(req.body.slug)).toLowerCase() : cliente.slug,
      status: req.body.status ? (normalizeStatusValue(String(req.body.status)) as Cliente["status"]) : cliente.status,
      logo_url: req.body.logo_url !== undefined ? (req.body.logo_url ? String(req.body.logo_url) : null) : cliente.logo_url || null,
      cor_primaria: req.body.cor_primaria !== undefined ? (req.body.cor_primaria ? String(req.body.cor_primaria) : null) : cliente.cor_primaria || null,
      cor_secundaria: req.body.cor_secundaria !== undefined ? (req.body.cor_secundaria ? String(req.body.cor_secundaria) : null) : cliente.cor_secundaria || null,
      atualizado_em: new Date().toISOString(),
    };

    if (!(await canUseSupabase())) {
      const index = memoryStore.clientes.findIndex((item) => item.id === cliente.id);
      if (index >= 0) memoryStore.clientes[index] = payload;
      await addLog("Clientes", "info", `Cliente '${payload.nome}' atualizado.`, { clienteId: payload.id }, payload.id);
      return res.json({ success: true, cliente: payload });
    }

    const updated = await supabaseRequest<Cliente[]>(`clientes?id=eq.${sanitizeId(cliente.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });

    const clienteAtualizado = updated[0] || payload;
    await addLog("Clientes", "info", `Cliente '${clienteAtualizado.nome}' atualizado.`, { clienteId: clienteAtualizado.id }, clienteAtualizado.id);
    res.json({ success: true, cliente: clienteAtualizado });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao atualizar cliente.");
  }
});

app.post("/api/clientes", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (!canEditClientSettings(actingUser)) {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para editar integraÃ§Ãµes do cliente.");
    }
    const nome = trimEnv(req.body.nome);
    const slug = trimEnv(req.body.slug).toLowerCase();
    if (!nome || !slug) {
      return res.status(400).json({ error: "Nome e slug sÃ£o obrigatÃ³rios." });
    }

    const now = new Date().toISOString();
    const payload: Cliente = {
      id: randomUUID(),
      nome,
      slug,
      status: normalizeStatusValue(req.body.status) === "INATIVO" ? "INATIVO" : normalizeStatusValue(req.body.status) === "SUSPENSO" ? "SUSPENSO" : "ATIVO",
      logo_url: req.body.logo_url || null,
      cor_primaria: req.body.cor_primaria || null,
      cor_secundaria: req.body.cor_secundaria || null,
      criado_em: now,
      atualizado_em: now,
    };

    if (!(await canUseSupabase())) {
      memoryStore.clientes.unshift(payload);
      await ensureClienteSetup(payload.id);
      await addLog("Clientes", "success", `Cliente '${payload.nome}' criado em modo local.`, { clienteId: payload.id });
      return res.status(201).json({ success: true, cliente: payload });
    }

    const created = await supabaseRequest<Cliente[]>("clientes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });

    const cliente = created[0];
    await ensureClienteSetup(cliente.id);
    await addLog("Clientes", "success", `Cliente '${cliente.nome}' criado.`, { clienteId: cliente.id }, cliente.id);
    res.status(201).json({ success: true, cliente });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao criar cliente.");
  }
});

app.get("/api/clientes/:clienteId/integracoes", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    }

    if (!(await canUseSupabase())) {
      const local = { cliente_id: cliente.id, modo_operacao: "SIMULADOR" } as ClienteIntegracao;
      return res.json({ integracao: sanitizeClienteIntegracaoForResponse(local) });
    }

    const records = await supabaseRequest<ClienteIntegracao[]>(
      `cliente_integracoes?cliente_id=eq.${sanitizeId(cliente.id)}&select=*`,
    );
    res.json({
      integracao: sanitizeClienteIntegracaoForResponse(records[0] || ({ cliente_id: cliente.id, modo_operacao: "SIMULADOR" } as ClienteIntegracao)),
    });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao buscar integraÃ§Ãµes do cliente.");
  }
});

app.patch("/api/clientes/:clienteId/integracoes", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (!canEditClientSettings(actingUser)) {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para editar integraÃ§Ãµes do cliente.");
    }
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    }

    const rawManualInstagramToken = trimEnv(req.body.instagram_access_token ?? "");
    const manualInstagramToken =
      rawManualInstagramToken === "IG...****" || rawManualInstagramToken === "ENCRYPTED" ? "" : rawManualInstagramToken;
    const payload: Partial<ClienteIntegracao> & { cliente_id: string } = {
      cliente_id: cliente.id,
      google_drive_folder_id: req.body.google_drive_folder_id ?? null,
      google_drive_entrada_folder_id: req.body.google_drive_entrada_folder_id ?? req.body.google_drive_imagens_folder_id ?? null,
      google_drive_aprovacao_folder_id: req.body.google_drive_aprovacao_folder_id ?? null,
      google_drive_aprovados_folder_id: req.body.google_drive_aprovados_folder_id ?? null,
      google_drive_imagens_folder_id: req.body.google_drive_imagens_folder_id ?? null,
      google_drive_videos_folder_id: req.body.google_drive_videos_folder_id ?? null,
      google_drive_publicados_folder_id: req.body.google_drive_publicados_folder_id ?? null,
      google_drive_rejeitados_folder_id: req.body.google_drive_rejeitados_folder_id ?? null,
      google_drive_arquivados_folder_id: req.body.google_drive_arquivados_folder_id ?? null,
      google_account_email: req.body.google_account_email ?? undefined,
      google_drive_status: req.body.google_drive_status ?? undefined,
      instagram_username: req.body.instagram_username ?? null,
      instagram_access_token: null,
      instagram_access_token_encrypted: manualInstagramToken ? encryptSecretValue(manualInstagramToken) : undefined,
      instagram_token_status: manualInstagramToken ? (req.body.instagram_token_status ?? "ATIVO_TESTE") : req.body.instagram_token_status ?? undefined,
      instagram_token_expires_at: req.body.instagram_token_expires_at ?? null,
      instagram_connected_at: manualInstagramToken ? new Date().toISOString() : req.body.instagram_connected_at ?? null,
      instagram_last_sync_at: req.body.instagram_last_sync_at ?? null,
      instagram_connection_mode: req.body.instagram_connection_mode ?? (manualInstagramToken ? "MANUAL_TEST_TOKEN" : undefined),
      instagram_webhook_enabled: req.body.instagram_webhook_enabled ?? false,
      instagram_user_id: req.body.instagram_user_id ?? null,
      instagram_business_id: req.body.instagram_business_id ?? null,
      instagram_media_actor_id: req.body.instagram_media_actor_id ?? null,
      facebook_page_id: req.body.facebook_page_id ?? null,
      graph_api_version: req.body.graph_api_version ?? "v23.0",
      modo_operacao: req.body.modo_operacao === "REAL" ? "REAL" : "SIMULADOR",
      atualizado_em: new Date().toISOString(),
      criado_em: new Date().toISOString(),
    };

    if (!(await canUseSupabase())) {
      const current = memoryStore.clientes.findIndex((item) => item.id === cliente.id);
      if (current === -1) {
        return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
      }
      await addLog("Clientes", "info", "IntegraÃ§Ãµes do cliente atualizadas em modo local.", { clienteId: cliente.id }, cliente.id);
      return res.json({ success: true, integracao: sanitizeClienteIntegracaoForResponse(payload as ClienteIntegracao) });
    }

    const existing = await supabaseRequest<ClienteIntegracao[]>(
      `cliente_integracoes?cliente_id=eq.${sanitizeId(cliente.id)}&select=*`,
    );
    const result = existing.length
      ? await supabaseRequest<ClienteIntegracao[]>(
          `cliente_integracoes?cliente_id=eq.${sanitizeId(cliente.id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(payload),
          },
        )
      : await supabaseRequest<ClienteIntegracao[]>("cliente_integracoes", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });

    await upsertClienteConfiguracao(cliente.id, {
      chave: "MODO_OPERACAO",
      valor: payload.modo_operacao === "REAL" ? "REAL" : "SIMULADOR",
      valor_encrypted: null,
      tipo: "STRING",
      categoria: "GERAL",
      descricao: "Modo operacional do cliente.",
      sensivel: false,
      editavel_por_cliente: false,
      usar_padrao_sistema: false,
    });

    await addLog("Clientes", "info", "IntegraÃ§Ãµes do cliente atualizadas.", { clienteId: cliente.id }, cliente.id);
    res.json({ success: true, integracao: sanitizeClienteIntegracaoForResponse((result[0] || payload) as ClienteIntegracao) });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao atualizar integraÃ§Ãµes do cliente.");
  }
});

app.get("/api/clientes/:clienteId/usuarios", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    if (actingUser.perfil_publicacao !== "SUPER_ADMIN" && actingUser.perfil_publicacao !== "ADMIN_CLIENTE" && actingUser.perfil_publicacao !== "ADMIN") {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para visualizar usuÃ¡rios do cliente.");
    }

    const memberships = await listClienteUsuarios(cliente.id);
    const users = await listUsers();
    const items = memberships.map((membership) => {
      const user = users.find((item) => item.id === membership.usuario_id);
      return {
        usuario_id: membership.usuario_id,
        nome: user?.nome || "UsuÃ¡rio",
        email: user?.email || "",
        perfil: membership.perfil,
        status: membership.status,
        ultima_atividade: user?.criado_em || membership.criado_em,
      };
    });

    res.json({ items, total: items.length });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao listar usuÃ¡rios do cliente.");
  }
});

app.post("/api/clientes/:clienteId/usuarios/convites", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (actingUser.perfil_publicacao !== "SUPER_ADMIN" && actingUser.perfil_publicacao !== "ADMIN_CLIENTE" && actingUser.perfil_publicacao !== "ADMIN") {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para convidar usuÃ¡rios do cliente.");
    }

    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });

    const nome = trimEnv(String(req.body.nome || ""));
    const email = trimEnv(String(req.body.email || "")).toLowerCase();
    const perfil = inferPerfilPublicacaoFromRawValue(req.body.perfil || "CRIADOR");
    if (!nome || !email) return res.status(400).json({ error: "Nome e e-mail sÃ£o obrigatÃ³rios." });

    const users = await listUsers();
    let user = users.find((item) => item.email.toLowerCase() === email);
    if (!user) {
      user = await createOperationalUserRecord({
        nome,
        email,
        perfil_publicacao: perfil,
        ativo: false,
      });
    }

    const membership = await upsertClienteUsuario(cliente.id, {
      usuario_id: user.id,
      perfil: perfil === "SUPER_ADMIN" ? "ADMIN_CLIENTE" : perfil === "ADMIN" ? "ADMIN_CLIENTE" : (perfil as ClienteUsuario["perfil"]),
      status: "ATIVO",
    });

    await addLog("Clientes", "success", `UsuÃ¡rio '${user.email}' vinculado ao cliente '${cliente.nome}'.`, { clienteId: cliente.id, usuarioId: user.id }, cliente.id);
    res.status(201).json({ success: true, membership, user });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao convidar usuÃ¡rio do cliente.");
  }
});

app.patch("/api/clientes/:clienteId/usuarios/:usuarioId", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (actingUser.perfil_publicacao !== "SUPER_ADMIN" && actingUser.perfil_publicacao !== "ADMIN_CLIENTE" && actingUser.perfil_publicacao !== "ADMIN") {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para editar usuÃ¡rios do cliente.");
    }

    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });

    const memberships = await listClienteUsuarios(cliente.id);
    const membership = memberships.find((item) => item.usuario_id === req.params.usuarioId);
    if (!membership) return res.status(404).json({ error: "VÃ­nculo do usuÃ¡rio nÃ£o encontrado." });

    const updated = await upsertClienteUsuario(cliente.id, {
      usuario_id: req.params.usuarioId,
      perfil: req.body.perfil || membership.perfil,
      status: req.body.status || membership.status,
    });

    if (req.body.ativo !== undefined) {
      await updateUserRecord(req.params.usuarioId, { ativo: Boolean(req.body.ativo) });
    }

    await addLog("Clientes", "info", `UsuÃ¡rio do cliente '${cliente.nome}' atualizado.`, { clienteId: cliente.id, usuarioId: req.params.usuarioId }, cliente.id);
    res.json({ success: true, membership: updated });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao atualizar usuÃ¡rio do cliente.");
  }
});

app.delete("/api/clientes/:clienteId/usuarios/:usuarioId", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (actingUser.perfil_publicacao !== "SUPER_ADMIN" && actingUser.perfil_publicacao !== "ADMIN_CLIENTE" && actingUser.perfil_publicacao !== "ADMIN") {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para remover usuÃ¡rios do cliente.");
    }

    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });

    if (!(await canUseSupabase())) {
      memoryStore.clienteUsuarios = memoryStore.clienteUsuarios.filter(
        (item) => !(item.cliente_id === cliente.id && item.usuario_id === req.params.usuarioId),
      );
    } else {
      await supabaseRequest<unknown>(
        `cliente_usuarios?cliente_id=eq.${sanitizeId(cliente.id)}&usuario_id=eq.${sanitizeId(req.params.usuarioId)}`,
        { method: "DELETE" },
      );
    }

    await addLog("Clientes", "warn", `UsuÃ¡rio removido do cliente '${cliente.nome}'.`, { clienteId: cliente.id, usuarioId: req.params.usuarioId }, cliente.id);
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao remover usuÃ¡rio do cliente.");
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    res.json({ user: await getActingUserFromRequest(req) });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao validar usuÃ¡rio autenticado.", 401);
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const clienteId = await resolveClienteIdFromRequest(req);
    res.json({ settings: await getSettingsView(clienteId), clienteId });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao ler estado das integraÃ§Ãµes.");
  }
});

app.post("/api/settings", (_req, res) => {
  res.status(405).json({
    success: false,
    error: "Use as rotas de cliente e as tabelas do Supabase para configurar cada cliente. O endpoint legado de settings foi descontinuado.",
  });
});

app.get("/api/admin/configuracoes/sistema", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    const items = await listSistemaConfiguracoes();
    res.json({ items });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao carregar configuraÃ§Ãµes do sistema.");
  }
});

app.patch("/api/admin/configuracoes/sistema", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const updated: SistemaConfiguracao[] = [];

    for (const item of items) {
      if (!item?.chave) continue;
      const saved = await upsertSistemaConfiguracao({
        chave: String(item.chave),
        valor: item.valor ?? null,
        valor_encrypted: item.valor_encrypted ?? null,
        tipo: item.tipo ?? "STRING",
        categoria: item.categoria ?? "GERAL",
        descricao: item.descricao ?? null,
        sensivel: Boolean(item.sensivel),
        editavel: item.editavel !== undefined ? Boolean(item.editavel) : true,
      });
      updated.push(saved);
      await createParametroAuditoria({
        escopo: "SISTEMA",
        usuario_id: actingUser.id,
        chave: saved.chave,
        categoria: saved.categoria,
        valor_anterior_mascarado: "",
        valor_novo_mascarado: saved.sensivel ? maskSecretValue(saved.valor_encrypted || saved.valor) : stringifyConfigValue(saved.valor),
        acao: "ALTERADO",
        origem: "WEBAPP",
      });
    }

    res.json({ success: true, items: updated });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao atualizar configuraÃ§Ãµes do sistema.");
  }
});

app.post("/api/admin/configuracoes/sistema/testar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    await createParametroAuditoria({
      escopo: "SISTEMA",
      usuario_id: actingUser.id,
      chave: "TESTE_CONFIGURACAO_SISTEMA",
      categoria: "GERAL",
      valor_anterior_mascarado: null,
      valor_novo_mascarado: "OK",
      acao: "TESTADO",
      origem: "WEBAPP",
    });
    res.json({ success: true, message: "ConfiguraÃ§Ã£o do sistema testada com sucesso." });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao testar configuraÃ§Ã£o do sistema.");
  }
});

app.get("/api/clientes/:clienteId/configuracoes", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    await ensureClienteSetup(cliente.id);
    const configs = await listClienteConfiguracoes(cliente.id);
    const integracoes = await getClienteIntegracao(cliente.id);
    const auditoria = await listParametroAuditoria(cliente.id);
    res.json({ cliente, configuracoes: configs, integracoes, auditoria, user: actingUser });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao carregar configuraÃ§Ãµes do cliente.");
  }
});

app.patch("/api/clientes/:clienteId/configuracoes", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    if (!canEditClientSettings(actingUser)) {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para alterar configuraÃ§Ãµes do cliente.");
    }
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const updated: ClienteConfiguracao[] = [];

    for (const item of items) {
      if (!item?.chave) continue;
      const saved = await upsertClienteConfiguracao(cliente.id, {
        chave: String(item.chave),
        valor: item.valor ?? null,
        valor_encrypted: item.valor_encrypted ?? null,
        tipo: item.tipo ?? "STRING",
        categoria: item.categoria ?? "GERAL",
        descricao: item.descricao ?? null,
        sensivel: Boolean(item.sensivel),
        editavel_por_cliente: Boolean(item.editavel_por_cliente),
        usar_padrao_sistema: Boolean(item.usar_padrao_sistema),
      });
      updated.push(saved);
      await createParametroAuditoria({
        escopo: "CLIENTE",
        cliente_id: cliente.id,
        usuario_id: actingUser.id,
        chave: saved.chave,
        categoria: saved.categoria,
        valor_anterior_mascarado: "",
        valor_novo_mascarado: saved.sensivel ? maskSecretValue(saved.valor_encrypted || saved.valor) : stringifyConfigValue(saved.valor),
        acao: "ALTERADO",
        origem: "WEBAPP",
      });

      if (saved.chave === "MODO_OPERACAO") {
        await updateClienteIntegracaoRecord(cliente.id, {
          modo_operacao: String(saved.valor).toUpperCase() === "REAL" ? "REAL" : "SIMULADOR",
        });
      }
    }

    res.json({ success: true, items: updated });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao atualizar configuraÃ§Ãµes do cliente.");
  }
});

app.get("/api/clientes/:clienteId/ia/configuracao", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const configs = await listClienteConfiguracoes(cliente.id);
    const items = configs.filter((config) => config.categoria === "IA");
    res.json({ items });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao carregar configuraÃ§Ã£o de IA.");
  }
});

app.patch("/api/clientes/:clienteId/ia/configuracao", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const updated: ClienteConfiguracao[] = [];
    for (const item of items) {
      if (!item?.chave) continue;
      const saved = await upsertClienteConfiguracao(cliente.id, {
        chave: String(item.chave),
        valor: item.valor ?? null,
        valor_encrypted: item.valor_encrypted ?? null,
        tipo: item.tipo ?? "STRING",
        categoria: "IA",
        descricao: item.descricao ?? null,
        sensivel: Boolean(item.sensivel),
        editavel_por_cliente: Boolean(item.editavel_por_cliente),
        usar_padrao_sistema: Boolean(item.usar_padrao_sistema),
      });
      updated.push(saved);
      await createParametroAuditoria({
        escopo: "IA",
        cliente_id: cliente.id,
        usuario_id: actingUser.id,
        chave: saved.chave,
        categoria: "IA",
        valor_anterior_mascarado: "",
        valor_novo_mascarado: saved.sensivel ? maskSecretValue(saved.valor_encrypted || saved.valor) : stringifyConfigValue(saved.valor),
        acao: "ALTERADO",
        origem: "WEBAPP",
      });
    }
    res.json({ success: true, items: updated });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao atualizar configuraÃ§Ã£o de IA.");
  }
});

app.post("/api/clientes/:clienteId/ia/testar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const context = await getClienteOperationalContext(cliente.id);
    if (!context.aiConfigured) {
      throw new HttpError(400, "Cliente sem chave de IA configurada.");
    }
    await createParametroAuditoria({
      escopo: "IA",
      cliente_id: cliente.id,
      usuario_id: actingUser.id,
      chave: "IA_TESTE",
      categoria: "IA",
      valor_anterior_mascarado: null,
      valor_novo_mascarado: "OK",
      acao: "TESTADO",
      origem: "WEBAPP",
    });
    res.json({
      success: true,
      message: `IA do cliente pronta para uso com ${context.aiProvider} / ${context.aiModel}.`,
      provider: context.aiProvider,
      model: context.aiModel,
    });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao testar IA do cliente.");
  }
});

app.get("/api/clientes/:clienteId/regras-aprovacao", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const configs = await listClienteConfiguracoes(cliente.id);
    const items = configs.filter((config) => config.categoria === "APROVACAO");
    res.json({ items });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao carregar regras de aprovaÃ§Ã£o.");
  }
});

app.patch("/api/clientes/:clienteId/regras-aprovacao", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const updated: ClienteConfiguracao[] = [];
    for (const item of items) {
      if (!item?.chave) continue;
      const saved = await upsertClienteConfiguracao(cliente.id, {
        chave: String(item.chave),
        valor: item.valor ?? null,
        valor_encrypted: item.valor_encrypted ?? null,
        tipo: item.tipo ?? "STRING",
        categoria: "APROVACAO",
        descricao: item.descricao ?? null,
        sensivel: Boolean(item.sensivel),
        editavel_por_cliente: Boolean(item.editavel_por_cliente),
        usar_padrao_sistema: Boolean(item.usar_padrao_sistema),
      });
      updated.push(saved);
      await createParametroAuditoria({
        escopo: "APROVACAO",
        cliente_id: cliente.id,
        usuario_id: actingUser.id,
        chave: saved.chave,
        categoria: "APROVACAO",
        valor_anterior_mascarado: "",
        valor_novo_mascarado: stringifyConfigValue(saved.valor),
        acao: "ALTERADO",
        origem: "WEBAPP",
      });
    }
    res.json({ success: true, items: updated });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao atualizar regras de aprovaÃ§Ã£o.");
  }
});

app.get("/api/admin/logs/parametros", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    res.json({ items: await listParametroAuditoria() });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao carregar auditoria de parametros.");
  }
});

app.get("/api/clientes/:clienteId/logs/parametros", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    res.json({ items: await listParametroAuditoria(cliente.id) });
  } catch (error) {
    respondWithError(res, error, "Clientes", "Falha ao carregar auditoria do cliente.");
  }
});

app.post("/api/clientes/:clienteId/integracoes/google-drive/connect", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageGoogleDrive(actingUser);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    await ensureClienteSetup(cliente.id);
    const authorization_url = await buildGoogleDriveAuthorizationUrl({
      clienteId: cliente.id,
      usuarioId: actingUser.id,
      returnTo: trimEnv(String(req.body?.return_to || "/")),
    });
    res.json({ success: true, authorization_url });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao iniciar conexÃ£o Google Drive.", 400);
  }
});

app.post("/api/clientes/:clienteId/integracoes/google-drive/setup-folders", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageGoogleDrive(actingUser);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const integracao = await getClienteIntegracao(cliente.id);
    const rootFolderId = extractGoogleDriveFolderId(req.body?.google_drive_folder_id || integracao?.google_drive_folder_id || "");
    if (!rootFolderId) {
      throw new HttpError(400, "Defina primeiro a pasta raiz do Google Drive do cliente.");
    }
    await applyGoogleDriveRootFolder(cliente.id, rootFolderId, actingUser);
    const folders = await ensureDriveFolders(cliente.id);
    await setClienteGoogleDriveStatus(cliente.id, "ATIVO", {
      connectedAt: new Date().toISOString(),
      lastError: "",
    });
    res.json({ success: true, folders });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao criar estrutura de pastas do Google Drive.", 400);
  }
});

app.post("/api/clientes/:clienteId/integracoes/google-drive/use-existing-folder", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageGoogleDrive(actingUser);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const rootFolderId = trimEnv(String(req.body?.google_drive_folder_id || req.body?.folder_id || ""));
    const integration = await applyGoogleDriveRootFolder(cliente.id, rootFolderId, actingUser);
    const folder = await testDriveFolderAccessForClient(cliente.id, extractGoogleDriveFolderId(rootFolderId));
    res.json({ success: true, integration, folder });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao usar a pasta existente do Google Drive.", 400);
  }
});

app.post("/api/clientes/:clienteId/integracoes/google-drive/testar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageGoogleDrive(actingUser);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const integracao = await getClienteIntegracao(cliente.id);
    const folderId =
      extractGoogleDriveFolderId(req.body?.google_drive_folder_id || "") ||
      trimEnv(integracao?.google_drive_folder_id) ||
      trimEnv(getRuntimeConfig().googleDriveFolderId);
    const folder = await testDriveFolderAccessForClient(cliente.id, folderId);
    await createParametroAuditoria({
      escopo: "INTEGRACAO",
      cliente_id: cliente.id,
      usuario_id: actingUser.id,
      chave: "GOOGLE_DRIVE_TESTE",
      categoria: "INTEGRACAO",
      valor_anterior_mascarado: null,
      valor_novo_mascarado: folder.id,
      acao: "TESTADO",
      origem: "WEBAPP",
    });
    res.json({ success: true, message: `Conexão com a pasta '${folder.name}' validada com sucesso.`, folder });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao testar Google Drive.");
  }
});

app.post("/api/clientes/:clienteId/integracoes/google-drive/test", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageGoogleDrive(actingUser);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const integracao = await getClienteIntegracao(cliente.id);
    const folderId =
      extractGoogleDriveFolderId(req.body?.google_drive_folder_id || "") ||
      trimEnv(integracao?.google_drive_folder_id) ||
      trimEnv(getRuntimeConfig().googleDriveFolderId);
    const folder = await testDriveFolderAccessForClient(cliente.id, folderId);
    res.json({ success: true, message: `ConexÃ£o com a pasta '${folder.name}' validada com sucesso.`, folder });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao testar Google Drive.", 400);
  }
});

app.post("/api/clientes/:clienteId/integracoes/google-drive/disconnect", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageGoogleDrive(actingUser);
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    await setClienteGoogleDriveStatus(cliente.id, "DESCONECTADO", {
      token: "",
      accountEmail: "",
      connectedAt: "",
      lastError: "",
    });
    const integracao = await updateClienteIntegracaoRecord(cliente.id, {
      google_account_email: null,
      google_drive_refresh_token_encrypted: null,
      google_drive_token_expires_at: null,
      google_drive_status: "DESCONECTADO",
      google_drive_last_sync_at: null,
      google_drive_last_error: null,
    });
    await createParametroAuditoria({
      escopo: "INTEGRACAO",
      cliente_id: cliente.id,
      usuario_id: actingUser.id,
      chave: "GOOGLE_DRIVE_DISCONNECT",
      categoria: "INTEGRACAO",
      valor_anterior_mascarado: null,
      valor_novo_mascarado: "DESCONECTADO",
      acao: "ALTERADO",
      origem: "WEBAPP",
    });
    res.json({ success: true, integracao });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao desconectar Google Drive.", 400);
  }
});

app.get("/api/integrations/instagram/connect", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageInstagram(actingUser);
    const clienteId = trimEnv(String(req.query.clienteId || req.query.cliente_id || ""));
    const cliente = await getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const authorizationUrl = await buildInstagramAuthorizationUrl({
      clienteId: cliente.id,
      usuarioId: actingUser.id,
      provider: "INSTAGRAM_LOGIN",
      returnTo: trimEnv(String(req.query.return_to || "/")),
    });
    const wantsJson =
      String(req.query.format || "").toLowerCase() === "json" ||
      String(req.headers.accept || "").includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, authorization_url: authorizationUrl });
    }
    res.redirect(authorizationUrl);
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao iniciar conexÃ£o do Instagram.", 400);
  }
});

app.get("/api/integrations/meta/connect", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageInstagram(actingUser);
    const clienteId = trimEnv(String(req.query.clienteId || req.query.cliente_id || ""));
    const cliente = await getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const authorizationUrl = await buildInstagramAuthorizationUrl({
      clienteId: cliente.id,
      usuarioId: actingUser.id,
      provider: "FACEBOOK_LOGIN",
      returnTo: trimEnv(String(req.query.return_to || "/")),
    });
    const wantsJson =
      String(req.query.format || "").toLowerCase() === "json" ||
      String(req.headers.accept || "").includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, authorization_url: authorizationUrl });
    }
    res.redirect(authorizationUrl);
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao iniciar conexÃ£o Meta.", 400);
  }
});

app.get("/api/integrations/instagram/callback", async (req, res) => {
  const code = trimEnv(String(req.query.code || ""));
  const stateValue = trimEnv(String(req.query.state || ""));
  const errorReason = trimEnv(String(req.query.error_reason || req.query.error || ""));
  const errorDescription = trimEnv(String(req.query.error_description || ""));
  let resolvedState: InstagramOauthState | null = null;
  try {
    const state = await getInstagramOauthState(stateValue);
    resolvedState = state;
    if (!state || state.provider !== "INSTAGRAM_LOGIN") {
      throw new HttpError(400, "State do Instagram Login invÃ¡lido.");
    }
    if (state.used_at) {
      throw new HttpError(400, "State do Instagram Login jÃ¡ utilizado.");
    }
    if (new Date(state.expires_at).getTime() < Date.now()) {
      throw new HttpError(400, "State do Instagram Login expirado.");
    }
    if (errorReason || !code) {
      await addLog("Instagram API", "error", "Callback do Instagram retornou erro.", {
        clienteId: state.cliente_id,
        errorReason,
        errorDescription,
      }, state.cliente_id);
      return res.status(400).send(renderSimpleHtmlPage("Instagram nÃ£o conectado", `<p>${escapeHtml(errorDescription || errorReason || "AutorizaÃ§Ã£o cancelada.")}</p>`));
    }

    const tokenPayload = await exchangeInstagramCodeForToken(code);
    const shortLivedToken = trimEnv(String(tokenPayload.access_token || ""));
    const instagramUserId = trimEnv(String(tokenPayload.user_id || ""));

    if (!shortLivedToken) {
      throw new HttpError(400, "Instagram Login nao retornou access_token para salvar a integracao.");
    }

    const longLivedTokenPayload = await exchangeInstagramShortLivedForLongLivedToken(shortLivedToken);
    const accessToken = trimEnv(String(longLivedTokenPayload.access_token || shortLivedToken));
    const expiresAt = resolveExpiresAtFromSeconds(longLivedTokenPayload.expires_in);

    await ensureClienteSetup(state.cliente_id);
    const integration = await setClienteInstagramStatus(state.cliente_id, "ATIVO", {
      instagram_access_token_encrypted: accessToken ? encryptSecretValue(accessToken) : null,
      instagram_token_expires_at: expiresAt,
      instagram_user_id: instagramUserId || null,
      instagram_connected_at: new Date().toISOString(),
      instagram_last_sync_at: new Date().toISOString(),
      instagram_connection_mode: "INSTAGRAM_LOGIN",
    } as Partial<ClienteIntegracao>);
    await markInstagramOauthStateUsed(state.id, stateValue);
    await addLog("Instagram API", "success", "Conta conectada via Instagram Login.", {
      clienteId: state.cliente_id,
      instagramUserId,
    }, state.cliente_id);

    return res.send(
      renderOauthPopupResultPage("Instagram conectado", "Conta conectada via Instagram Login.", {
        type: "instaflow-instagram-oauth",
        success: true,
        clienteId: state.cliente_id,
        mode: "INSTAGRAM_LOGIN",
      }),
    );
  } catch (error) {
    if (resolvedState?.cliente_id) {
      await setClienteInstagramStatus(resolvedState.cliente_id, "ERRO", {
        instagram_last_sync_at: new Date().toISOString(),
      }).catch(() => undefined);
      await addLog("Instagram API", "error", "Falha no callback do Instagram Login.", {
        clienteId: resolvedState.cliente_id,
        error: maskError(error),
      }, resolvedState.cliente_id).catch(() => undefined);
    }
    return res
      .status(error instanceof HttpError ? error.status : 400)
      .send(
        renderOauthPopupResultPage("Falha no callback do Instagram", maskError(error), {
          type: "instaflow-instagram-oauth",
          success: false,
          clienteId: resolvedState?.cliente_id || null,
          mode: "INSTAGRAM_LOGIN",
          error: maskError(error),
        }),
      );
  }
});

app.get("/api/integrations/meta/callback", async (req, res) => {
  const code = trimEnv(String(req.query.code || ""));
  const stateValue = trimEnv(String(req.query.state || ""));
  const errorReason = trimEnv(String(req.query.error_reason || req.query.error || ""));
  const errorDescription = trimEnv(String(req.query.error_description || ""));
  try {
    const state = await getInstagramOauthState(stateValue);
    if (!state || state.provider !== "FACEBOOK_LOGIN") {
      throw new HttpError(400, "State do Facebook Login invÃ¡lido.");
    }
    if (state.used_at) {
      throw new HttpError(400, "State do Facebook Login jÃ¡ utilizado.");
    }
    if (new Date(state.expires_at).getTime() < Date.now()) {
      throw new HttpError(400, "State do Facebook Login expirado.");
    }
    if (errorReason || !code) {
      await addLog("Instagram API", "error", "Callback Meta retornou erro.", {
        clienteId: state.cliente_id,
        errorReason,
        errorDescription,
      }, state.cliente_id);
      return res.status(400).send(renderSimpleHtmlPage("Meta nÃ£o conectada", `<p>${escapeHtml(errorDescription || errorReason || "AutorizaÃ§Ã£o cancelada.")}</p>`));
    }

    const tokenPayload = await exchangeMetaCodeForToken(code);
    const accessToken = trimEnv(String(tokenPayload.access_token || ""));
    let pageId = "";
    let businessId = "";
    let username = "";

    if (accessToken) {
      const accounts = await metaGraphRequest<{ data?: Array<{ id?: string; access_token?: string }> }>(
        `/me/accounts?access_token=${encodeURIComponent(accessToken)}`,
      ).catch(() => ({ data: [] }));
      const firstPage = accounts.data?.[0];
      if (firstPage?.id) {
        pageId = firstPage.id;
        const pageDetails = (await metaGraphRequest<{ instagram_business_account?: { id?: string; username?: string } }>(
          `/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(firstPage.access_token || accessToken)}`,
        ).catch(() => ({} as { instagram_business_account?: { id?: string; username?: string } })));
        businessId = trimEnv(String(pageDetails.instagram_business_account?.id || ""));
        username = trimEnv(String(pageDetails.instagram_business_account?.username || ""));
      }
    }

    await ensureClienteSetup(state.cliente_id);
    await setClienteInstagramStatus(state.cliente_id, "ATIVO", {
      instagram_access_token_encrypted: accessToken ? encryptSecretValue(accessToken) : null,
      instagram_business_id: businessId || null,
      instagram_user_id: businessId || null,
      instagram_username: username || null,
      facebook_page_id: pageId || null,
      instagram_connected_at: new Date().toISOString(),
      instagram_last_sync_at: new Date().toISOString(),
      instagram_connection_mode: "FACEBOOK_LOGIN",
    });
    await markInstagramOauthStateUsed(state.id, stateValue);
    await addLog("Instagram API", "success", "Conta conectada via Facebook Login.", {
      clienteId: state.cliente_id,
      pageId,
      businessId,
    }, state.cliente_id);

    return res.send(
      renderOauthPopupResultPage("Meta conectada", "Conta conectada via Facebook Login.", {
        type: "instaflow-instagram-oauth",
        success: true,
        clienteId: state.cliente_id,
        mode: "FACEBOOK_LOGIN",
      }),
    );
  } catch (error) {
    return res.status(error instanceof HttpError ? error.status : 400).send(renderSimpleHtmlPage("Falha no callback Meta", `<p>${escapeHtml(maskError(error))}</p>`));
  }
});

app.post("/api/integrations/instagram/disconnect", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageInstagram(actingUser);
    const clienteId = trimEnv(String(req.body?.clienteId || req.query.clienteId || ""));
    const cliente = await getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const integration = await setClienteInstagramStatus(cliente.id, "DESCONECTADO", {
      instagram_access_token_encrypted: null,
      instagram_username: null,
      instagram_user_id: null,
      instagram_business_id: null,
      instagram_media_actor_id: null,
      facebook_page_id: null,
    });
    res.json({ success: true, integracao: sanitizeClienteIntegracaoForResponse(integration) });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao desconectar Instagram.", 400);
  }
});

app.post("/api/integrations/meta/disconnect", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageInstagram(actingUser);
    const clienteId = trimEnv(String(req.body?.clienteId || req.query?.clienteId || ""));
    const cliente = await getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const integration = await setClienteInstagramStatus(cliente.id, "DESCONECTADO", {
      instagram_access_token_encrypted: null,
      instagram_username: null,
      instagram_user_id: null,
      instagram_business_id: null,
      instagram_media_actor_id: null,
      facebook_page_id: null,
      instagram_connection_mode: "FACEBOOK_LOGIN",
    });
    res.json({ success: true, integracao: sanitizeClienteIntegracaoForResponse(integration) });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao desconectar Meta.", 400);
  }
});

app.post("/api/integrations/instagram/test", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageInstagram(actingUser);
    const clienteId = trimEnv(String(req.body?.clienteId || req.query?.clienteId || ""));
    const cliente = await getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const context = await getClienteOperationalContext(cliente.id);
    if (!context.instagramAccessToken || !getInstagramPublishingActorId(context)) {
      throw new HttpError(400, "Cliente sem token Instagram configurado.");
    }
    const actorId = getInstagramPublishingActorId(context);
    const actor = await instagramGraphRequest<Record<string, unknown>>(
      context,
      `/${actorId}?fields=id,username,name&access_token=${encodeURIComponent(context.instagramAccessToken)}`,
    );
    await setClienteInstagramStatus(cliente.id, context.instagramTokenStatus === "ATIVO_TESTE" ? "ATIVO_TESTE" : "ATIVO", {
      instagram_username: trimEnv(String(actor.username || context.instagramUsername || "")) || null,
      instagram_last_sync_at: new Date().toISOString(),
    });
    res.json({
      success: true,
      message: `ConexÃ£o Instagram validada para ${String(actor.username || actor.name || actor.id || actorId)}.`,
      actor,
    });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao testar Instagram.", 400);
  }
});

app.post("/api/integrations/meta/test", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanManageInstagram(actingUser);
    const clienteId = trimEnv(String(req.body?.clienteId || req.query?.clienteId || ""));
    const cliente = await getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const context = await getClienteOperationalContext(cliente.id);
    if (!context.instagramAccessToken || !getInstagramPublishingActorId(context)) {
      throw new HttpError(400, "Cliente sem token Meta/Instagram configurado.");
    }
    const actorId = getInstagramPublishingActorId(context);
    const actor = await instagramGraphRequest<Record<string, unknown>>(
      context,
      `/${actorId}?fields=id,username,name&access_token=${encodeURIComponent(context.instagramAccessToken)}`,
    );
    await setClienteInstagramStatus(cliente.id, context.instagramTokenStatus === "ATIVO_TESTE" ? "ATIVO_TESTE" : "ATIVO", {
      instagram_username: trimEnv(String(actor.username || context.instagramUsername || "")) || null,
      instagram_last_sync_at: new Date().toISOString(),
      instagram_connection_mode: "FACEBOOK_LOGIN",
    });
    res.json({
      success: true,
      message: `ConexÃ£o Meta validada para ${String(actor.username || actor.name || actor.id || actorId)}.`,
      actor,
    });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao testar Meta.", 400);
  }
});

app.get("/api/integrations/instagram/webhook", (req, res) => {
  const verifyToken = trimEnv(String(req.query["hub.verify_token"] || ""));
  const challenge = trimEnv(String(req.query["hub.challenge"] || ""));
  const expected = trimEnv(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN);
  if (verifyToken && challenge && verifyToken === expected) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("forbidden");
});

app.post("/api/integrations/instagram/webhook", async (req, res) => {
  await addLog("Instagram API", "info", "Webhook Instagram recebido.", req.body);
  res.json({ success: true });
});

app.post("/api/integrations/instagram/deauthorize", async (req, res) => {
  await handleInstagramDeauthorizeRequest((req.body || {}) as Record<string, unknown>);
  res.json({ success: true });
});

app.post("/api/integrations/instagram/data-deletion", async (req, res) => {
  res.json(await handleInstagramDataDeletionRequest((req.body || {}) as Record<string, unknown>));
});

app.post("/api/integrations/meta/deauthorize", async (req, res) => {
  await handleInstagramDeauthorizeRequest((req.body || {}) as Record<string, unknown>);
  res.json({ success: true });
});

app.post("/api/integrations/meta/data-deletion", async (req, res) => {
  res.json(await handleInstagramDataDeletionRequest((req.body || {}) as Record<string, unknown>));
});

app.post("/api/clientes/:clienteId/integracoes/meta/testar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (!canEditClientSettings(actingUser)) {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para testar integraÃ§Ãµes.");
    }
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const context = await getClienteOperationalContext(cliente.id);
    if (!context.instagramConfigured) {
      throw new HttpError(400, "Cliente sem token ou identificador Instagram/Meta configurado.");
    }
    const actorId = getInstagramPublishingActorId(context);
    const actor = await instagramGraphRequest<{ id?: string; username?: string; name?: string }>(
      context,
      `/${actorId}?fields=id,username,name&access_token=${encodeURIComponent(context.instagramAccessToken)}`,
    );
    await createParametroAuditoria({
      escopo: "INTEGRACAO",
      cliente_id: cliente.id,
      usuario_id: actingUser.id,
      chave: "META_TESTE",
      categoria: "INTEGRACAO",
      valor_anterior_mascarado: null,
      valor_novo_mascarado: actor.id || actorId,
      acao: "TESTADO",
      origem: "WEBAPP",
    });
    res.json({
      success: true,
      message: `Conexao Meta validada para ${actor.username || actor.name || actor.id || actorId}.`,
      actor,
    });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao testar Meta.");
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    res.json({ users: await listUsers() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar usuÃ¡rios.");
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);

    const nome = trimEnv(req.body.nome);
    const email = trimEnv(req.body.email).toLowerCase();
    const password = String(req.body.password || "").trim();
    const perfilPublicacao = inferPerfilPublicacaoFromRawValue(req.body.perfil_publicacao || "CRIADOR");
    const ativo = req.body.ativo === undefined ? true : Boolean(req.body.ativo);

    if (!nome) {
      return res.status(400).json({ error: "Nome Ã© obrigatÃ³rio." });
    }
    if (!email) {
      return res.status(400).json({ error: "E-mail Ã© obrigatÃ³rio." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Senha provisÃ³ria deve ter ao menos 6 caracteres." });
    }

    const existingUsers = await listUsers();
    if (existingUsers.some((user) => user.email.toLowerCase() === email)) {
      return res.status(409).json({ error: "JÃ¡ existe usuÃ¡rio operacional cadastrado com este e-mail." });
    }

    const roleColumnAvailable = await hasUsuariosRoleColumn();
    if (!roleColumnAvailable && perfilPublicacao === "APROVADOR") {
      return res.status(400).json({
        error: "A tabela usuarios ainda nÃ£o possui a coluna perfil_publicacao. Neste ambiente sÃ³ Ã© possÃ­vel usar Administrador ou Criador.",
      });
    }

    let authUserId = "";
    let linkedExistingAuthUser = false;
    try {
      authUserId = await createSupabaseAuthUser({ email, password, nome });
    } catch (error) {
      const detail = maskError(error);
      const looksLikeExistingEmail =
        detail.includes("email_exists") ||
        detail.includes("already been registered") ||
        detail.includes("already_registered");

      if (!looksLikeExistingEmail) {
        throw error;
      }

      const existingAuthUser = await findSupabaseAuthUserByEmail(email);
      if (!existingAuthUser) {
        throw error;
      }

      authUserId = existingAuthUser.id;
      linkedExistingAuthUser = true;
    }
    const created = await createOperationalUserRecord({
      nome,
      email,
      ativo,
      perfil_publicacao: perfilPublicacao,
      auth_user_id: authUserId,
    });

    await addLog("Database", "success", `UsuÃ¡rio '${created.email}' criado pelo painel.`, {
      userId: created.id,
      authUserId,
      perfil_publicacao: created.perfil_publicacao,
      ativo: created.ativo,
      linkedExistingAuthUser,
    });

    res.status(201).json({ success: true, user: created, linkedExistingAuthUser });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao criar usuÃ¡rio.");
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    const users = await listUsers();
    const existingUser = users.find((user) => user.id === req.params.id);
    if (!existingUser) {
      throw new HttpError(404, "UsuÃ¡rio nÃ£o encontrado.");
    }

    const roleColumnAvailable = await hasUsuariosRoleColumn();
    const perfilPublicacao = req.body.perfil_publicacao
      ? inferPerfilPublicacaoFromRawValue(req.body.perfil_publicacao)
      : undefined;
    if (!roleColumnAvailable && perfilPublicacao === "APROVADOR") {
      throw new HttpError(
        400,
        "A tabela usuarios ainda nÃ£o possui a coluna perfil_publicacao. Neste ambiente sÃ³ Ã© possÃ­vel usar Administrador ou Criador.",
      );
    }

    const nextEmail = trimEnv(req.body.email || existingUser.email).toLowerCase();
    if (!nextEmail) {
      throw new HttpError(400, "E-mail Ã© obrigatÃ³rio.");
    }

    const duplicatedEmail = users.find((user) => user.id !== req.params.id && user.email.toLowerCase() === nextEmail);
    if (duplicatedEmail) {
      throw new HttpError(409, "JÃ¡ existe outro usuÃ¡rio com este e-mail.");
    }

    if (existingUser.auth_user_id && (nextEmail !== existingUser.email.toLowerCase() || req.body.nome !== undefined)) {
      await updateSupabaseAuthUser(existingUser.auth_user_id, {
        email: nextEmail,
        nome: String(req.body.nome ?? existingUser.nome),
      });
    }

    const updated = await updateUserRecord(req.params.id, {
      nome: req.body.nome,
      email: nextEmail,
      ativo: req.body.ativo,
      perfil_publicacao: perfilPublicacao,
      perfil: perfilPublicacao ? (perfilPublicacao === "ADMIN" ? "ADMIN" : "OPERADOR") : req.body.perfil,
    });

    await addLog("Database", "info", `UsuÃ¡rio '${updated.email}' atualizado.`, {
      userId: updated.id,
      perfil_publicacao: updated.perfil_publicacao,
      ativo: updated.ativo,
    });

    res.json({ success: true, user: updated });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao atualizar usuÃ¡rio.");
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);

    const users = await listUsers();
    const target = users.find((user) => user.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: "UsuÃ¡rio nÃ£o encontrado." });
    }

    if (target.email.toLowerCase() === actingUser.email.toLowerCase()) {
      return res.status(400).json({ error: "NÃ£o Ã© permitido excluir o prÃ³prio usuÃ¡rio administrador em uso." });
    }

    if (target.auth_user_id) {
      await deleteSupabaseAuthUser(target.auth_user_id);
    }

    const deleted = await deleteOperationalUserRecord(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "UsuÃ¡rio nÃ£o encontrado." });
    }

    await addLog("Database", "warn", `UsuÃ¡rio '${deleted.email}' excluÃ­do do painel.`, {
      userId: deleted.id,
      authUserId: deleted.auth_user_id,
    });

    res.json({ success: true, user: deleted });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao excluir usuÃ¡rio.");
  }
});

app.post("/api/users/:id/reset-password", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);

    const newPassword = String(req.body.password || "").trim();
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Nova senha deve ter ao menos 6 caracteres." });
    }

    const users = await listUsers();
    const target = users.find((user) => user.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: "UsuÃ¡rio nÃ£o encontrado." });
    }

    if (!target.auth_user_id) {
      return res.status(400).json({ error: "Este usuÃ¡rio nÃ£o possui vÃ­nculo com Supabase Auth para redefiniÃ§Ã£o de senha." });
    }

    await updateSupabaseAuthUser(target.auth_user_id, {
      email: target.email,
      nome: target.nome,
      password: newPassword,
    });

    await addLog("Database", "info", `Senha do usuÃ¡rio '${target.email}' redefinida pelo painel.`, {
      userId: target.id,
      authUserId: target.auth_user_id,
    });

    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao redefinir senha do usuÃ¡rio.");
  }
});

app.post("/api/gemini/generate-caption", async (req, res) => {
  const { title, prompt, type, hashtagsCount } = req.body;
  const count = Number(hashtagsCount) || 5;

  try {
    await getActingUserFromRequest(req);
    const clienteId = await resolveClienteIdFromRequest(req);
    const context = await getClienteOperationalContext(clienteId);
    if (context.aiProvider !== "GEMINI") {
      throw new HttpError(400, `O cliente atual estÃ¡ configurado com ${context.aiProvider}. A geraÃ§Ã£o automÃ¡tica implementada no backend usa Gemini no momento.`);
    }
    const ai = getGeminiClientWithKey(context.aiApiKey || trimEnv(process.env.GEMINI_API_KEY));
    await addLog("Gemini AI", "info", "Gerando legenda com Gemini.", {
      title,
      prompt,
      type,
      model: context.aiModel,
      clienteId,
    });

    const response = await ai.models.generateContent({
      model: context.aiModel,
      contents: `Gere uma legenda engajadora para Instagram.
Titulo: "${title}"
Contexto: "${prompt || "Sem contexto adicional"}"
Tipo: "${type}"

Responda apenas JSON com:
{
  "legenda": "texto",
  "hashtags": "#tag1 #tag2"
}

Use exatamente ${count} hashtags.`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse((response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
    await addLog("Gemini AI", "success", "Legenda gerada com sucesso.");
    res.json({
      success: true,
      legenda: parsed.legenda || "",
      hashtags: parsed.hashtags || "",
    });
  } catch (error) {
    await addLog("Gemini AI", "warn", "Falha na Gemini API. Aplicando fallback local.", {
      error: maskError(error),
    });

    const fallbackHashtags = ["#instagram", "#marketingdigital", "#conteudo", "#socialmedia", "#branding"]
      .slice(0, count)
      .join(" ");

    res.json({
      success: true,
      legenda: `${title}\n\n${prompt || "ConteÃºdo preparado para revisÃ£o e publicaÃ§Ã£o no Instagram."}`,
      hashtags: fallbackHashtags,
      isFallback: true,
    });
  }
});

let initializationPromise: Promise<void> | null = null;

export async function initializeApp(options?: { enableStatic?: boolean }) {
  if (initializationPromise) {
    return initializationPromise;
  }

  const enableStatic = options?.enableStatic ?? false;

  initializationPromise = (async () => {
  try {
    const schema = await inspectSupabaseSchema(true);
    if (!schema.ready) {
      console.warn(`[InstaFlow] Supabase schema incompleto. Tabelas ausentes: ${schema.missingTables.join(", ")}`);
    }
  } catch (error) {
    console.warn(`[InstaFlow] Falha ao inspecionar schema Supabase: ${maskError(error)}`);
  }

  try {
    await listUsers();
  } catch (error) {
    await addLog("Database", "warn", "Falha ao validar base de usuÃ¡rios durante o bootstrap.", {
      error: maskError(error),
    });
  }

    if (enableStatic) {
      if (process.env.NODE_ENV !== "production") {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (_req, res) => {
          res.sendFile(path.join(distPath, "index.html"));
        });
      }
    }
  })();

  return initializationPromise;
}

export default app;





