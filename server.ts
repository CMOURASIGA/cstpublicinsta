import { createHmac, createSign, randomUUID } from "crypto";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import {
  Cliente,
  ClienteConfiguracao,
  ClienteIntegracao,
  ClienteUsuario,
  HistoricoPost,
  LogMessage,
  ParametroAuditoria,
  PerfilPublicacao,
  Post,
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
  clienteUsuarios: ClienteUsuario[];
  parametroAuditoria: ParametroAuditoria[];
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
  imagensId: string;
  videosId: string;
  publicadosId: string;
}

interface ClienteOperationalContext {
  clienteId: string | null;
  driveRootId: string;
  driveImagesId: string;
  driveVideosId: string;
  drivePublishedId: string;
  googleRefreshToken: string;
  graphApiVersion: string;
  instagramAccessToken: string;
  instagramUserId: string;
  instagramBusinessId: string;
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
];

const memoryStore: MemoryStore = {
  clientes: [...defaultClientes],
  sistemaConfiguracoes: [],
  clienteConfiguracoes: [],
  clienteIntegracoes: [],
  clienteUsuarios: [],
  parametroAuditoria: [],
  posts: [],
  usuarios: [...defaultUsers],
  historicos: [],
  logs: [],
};

const REQUIRED_SUPABASE_TABLES = ["clientes", "cliente_usuarios", "cliente_integracoes", "posts", "usuarios", "historico_posts", "logs"] as const;
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
  const googleRedirectUri = trimEnv(process.env.GOOGLE_REDIRECT_URI);
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
  const metaVerifyToken = trimEnv(process.env.META_VERIFY_TOKEN);
  const appUrl = normalizeAppUrl(rawAppUrl);
  const appUrlIsPublic = Boolean(rawAppUrl) && !isLocalhostUrl(appUrl);
  const geminiModel = trimEnv(process.env.GEMINI_MODEL) || "gemini-3.5-flash";
  const mediaUrlSigningSecret = trimEnv(process.env.MEDIA_URL_SIGNING_SECRET) || "local-media-secret";

  const supabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);
  const googleAuthConfigured = Boolean(
    (googleClientEmail && googlePrivateKey) || (googleClientId && googleClientSecret && googleRefreshToken),
  );
  const googleConfigured = Boolean(googleDriveFolderId && googleAuthConfigured);
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
      google_drive_imagens_folder_id: null,
      google_drive_videos_folder_id: null,
      google_drive_publicados_folder_id: null,
      instagram_access_token: null,
      instagram_user_id: null,
      instagram_business_id: null,
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
    (await resolveConfigValue(clienteId || null, "GOOGLE_REFRESH_TOKEN")) || runtime.googleRefreshToken;
  const driveRootId =
    integrations?.google_drive_folder_id ||
    trimEnv(process.env.GOOGLE_DRIVE_FOLDER_ID) ||
    trimEnv(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const driveImagesId = integrations?.google_drive_imagens_folder_id || trimEnv(process.env.GOOGLE_DRIVE_IMAGES_FOLDER_ID);
  const driveVideosId = integrations?.google_drive_videos_folder_id || trimEnv(process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID);
  const drivePublishedId =
    integrations?.google_drive_publicados_folder_id || trimEnv(process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID);
  const instagramAccessToken = integrations?.instagram_access_token || runtime.instagramAccessToken;
  const instagramUserId = integrations?.instagram_user_id || runtime.instagramUserId;
  const instagramBusinessId = integrations?.instagram_business_id || runtime.instagramBusinessId;
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
    integrations?.modo_operacao === "REAL" &&
    googleConfigured &&
    instagramConfigured
      ? "REAL"
      : "SIMULATOR";

  return {
    clienteId: clienteId || null,
    driveRootId,
    driveImagesId,
    driveVideosId,
    drivePublishedId,
    googleRefreshToken,
    graphApiVersion,
    instagramAccessToken,
    instagramUserId,
    instagramBusinessId,
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

  if (config.googleClientEmail && config.googlePrivateKey) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claimSet = base64UrlEncode(
      JSON.stringify({
        iss: config.googleClientEmail,
        scope: "https://www.googleapis.com/auth/drive",
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

  const imagensId = context.driveImagesId || (await findOrCreateDriveFolderForClient(clienteId, "Imagens", context.driveRootId));
  const videosId = context.driveVideosId || (await findOrCreateDriveFolderForClient(clienteId, "Videos", context.driveRootId));
  const publicadosId =
    context.drivePublishedId || (await findOrCreateDriveFolderForClient(clienteId, "Publicados", context.driveRootId));

  return {
    rootId: context.driveRootId,
    imagensId,
    videosId,
    publicadosId,
  };
}

async function uploadFileToGoogleDrive(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}, clienteId?: string | null): Promise<{ fileId: string; url: string; folderName: string }> {
  const folders = await ensureDriveFolders(clienteId);
  const isVideo = inferPostType(input.mimeType, input.filename) !== "IMAGEM";
  const parentId = isVideo ? folders.videosId : folders.imagensId;
  const folderName = isVideo ? "Videos" : "Imagens";
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

async function instagramGraphRequest<T>(
  context: ClienteOperationalContext,
  resource: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = context.instagramGraphBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/${context.graphApiVersion}${resource}`, init);
  if (!response.ok) {
    throw new Error(`Instagram Graph ${response.status}: ${await response.text()}`);
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

async function publishPost(post: Post, author: string): Promise<Post> {
  const context = await getClienteOperationalContext(post.cliente_id || null);
  await addLog("Instagram API", "info", `Iniciando publicaÃ§Ã£o do post '${post.titulo}'.`, {
    postId: post.id,
    postType: post.tipo,
    publishingActorId: getInstagramPublishingActorId(context),
    graphBaseUrl: context.instagramGraphBaseUrl,
  }, post.cliente_id || undefined);

  if (!(await canUseRealMode(post.cliente_id || null))) {
    const simulated = await updatePostRecord(post.id, {
      status: "PUBLICADA",
      instagram_post_id: `sim_${Date.now()}`,
      data_publicacao: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
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
    status: "APROVADA",
    atualizado_em: new Date().toISOString(),
  });

  await waitForContainerReady(creationId, post.cliente_id || null);
  const published = await publishInstagramContainer(creationId, post.cliente_id || null);
  const next = await updatePostRecord(post.id, {
    status: "PUBLICADA",
    instagram_post_id: published.mediaId,
    data_publicacao: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
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

  return next;
}

async function importGoogleDrivePosts(author: string, clienteId?: string | null): Promise<Post[]> {
  const folders = await ensureDriveFolders(clienteId);
  const [images, videos] = await Promise.all([
    listDriveFilesFromFolderForClient(clienteId, folders.imagensId),
    listDriveFilesFromFolderForClient(clienteId, folders.videosId),
  ]);

  const files = [...images, ...videos];
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
  }, undefined);

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
        await updatePostRecord(req.params.id, {
          status: "ERRO",
          erro_detalhe: maskError(error),
          atualizado_em: new Date().toISOString(),
          cliente_id: await resolveClienteIdFromRequest(req),
        });
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

app.get("/api/google/oauth/start", (req, res) => {
  const config = getRuntimeConfig();
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    const missing = [
      !config.googleClientId ? "GOOGLE_CLIENT_ID" : "",
      !config.googleClientSecret ? "GOOGLE_CLIENT_SECRET" : "",
      !config.googleRedirectUri ? "GOOGLE_REDIRECT_URI" : "",
    ].filter(Boolean);
    const wantsJson =
      String(req.query.format || "").toLowerCase() === "json" ||
      String(req.headers.accept || "").includes("application/json");
    const message = `Faltam credenciais globais do app OAuth do Google: ${missing.join(", ")}.`;
    if (wantsJson) {
      return res.status(400).json({ error: message, missing });
    }
    return res
      .status(400)
      .send(
        renderSimpleHtmlPage(
          "Google OAuth indisponivel",
          `<p>${escapeHtml(message)}</p>
           <div class="box">
             <strong>O que configurar no ambiente</strong>
             <pre><code>GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=</code></pre>
           </div>
           <div class="box">
             <strong>Redirect URI local sugerida</strong>
             <p><code>http://localhost:3000/api/google/oauth/callback</code></p>
           </div>`,
        ),
      );
  }
  const clienteId = trimEnv(String(req.query.cliente_id || ""));
  const returnTo = trimEnv(String(req.query.return_to || "/"));
  const state = createSignedState({
    clienteId,
    returnTo,
    createdAt: Date.now(),
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.googleClientId);
  url.searchParams.set("redirect_uri", config.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/drive");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

app.get("/api/google/oauth/status", async (_req, res) => {
  const config = getRuntimeConfig();
  const missing = [
    !config.googleClientId ? "GOOGLE_CLIENT_ID" : "",
    !config.googleClientSecret ? "GOOGLE_CLIENT_SECRET" : "",
    !config.googleRedirectUri ? "GOOGLE_REDIRECT_URI" : "",
  ].filter(Boolean);
  res.json({
    ready: missing.length === 0,
    missing,
    redirectUri: config.googleRedirectUri,
  });
});

app.get("/api/google/oauth/callback", async (req, res) => {
  try {
    const config = getRuntimeConfig();
    const code = trimEnv(String(req.query.code || ""));
    const rawState = trimEnv(String(req.query.state || ""));
    const state = parseSignedState<{ clienteId?: string; returnTo?: string; createdAt?: number }>(rawState);
    if (!code) {
      return res.status(400).json({ error: "ParÃ¢metro code ausente." });
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

    if (state?.clienteId) {
      await ensureClienteSetup(state.clienteId);
      if (refreshToken) {
        await upsertClienteConfiguracao(state.clienteId, {
          chave: "GOOGLE_REFRESH_TOKEN",
          valor: null,
          valor_encrypted: refreshToken,
          tipo: "SECRET",
          categoria: "INTEGRACAO",
          descricao: "Refresh token da conta Google conectada ao cliente.",
          sensivel: true,
          editavel_por_cliente: false,
          usar_padrao_sistema: false,
        });
      }
      if (googleAccountEmail) {
        await upsertClienteConfiguracao(state.clienteId, {
          chave: "GOOGLE_OAUTH_ACCOUNT_EMAIL",
          valor: googleAccountEmail,
          valor_encrypted: null,
          tipo: "STRING",
          categoria: "INTEGRACAO",
          descricao: "Conta Google conectada ao cliente.",
          sensivel: false,
          editavel_por_cliente: false,
          usar_padrao_sistema: false,
        });
      }
      await upsertClienteConfiguracao(state.clienteId, {
        chave: "GOOGLE_OAUTH_CONNECTED_AT",
        valor: new Date().toISOString(),
        valor_encrypted: null,
        tipo: "STRING",
        categoria: "INTEGRACAO",
        descricao: "Data da ultima conexao Google do cliente.",
        sensivel: false,
        editavel_por_cliente: false,
        usar_padrao_sistema: false,
      });
    }

    const envSnippet = [
      `GOOGLE_CLIENT_ID=${config.googleClientId}`,
      `GOOGLE_CLIENT_SECRET=${config.googleClientSecret}`,
      `GOOGLE_REFRESH_TOKEN=${refreshToken}`,
      `GOOGLE_REDIRECT_URI=${config.googleRedirectUri}`,
      `GOOGLE_DRIVE_FOLDER_ID=${config.googleDriveFolderId}`,
    ].join("\n");

    const payload = {
      success: true,
      message: state?.clienteId
        ? refreshToken
          ? "Conta Google conectada ao cliente com sucesso."
          : "O login Google concluiu, mas o refresh_token nao foi retornado. Revogue o acesso e repita a conexao."
        : refreshToken
          ? "Callback Google concluÃ­do. Salve o refresh_token nas variÃ¡veis de ambiente."
          : "Callback Google concluÃ­do, mas o Google nÃ£o retornou refresh_token. Revogue o acesso do app e repita com prompt=consent.",
      refreshToken,
      googleAccountEmail,
      clienteId: state?.clienteId || "",
      envSnippet,
      tokens,
    };
    const popupMessage = JSON.stringify({
      type: "instaflow-google-oauth",
      ...payload,
    }).replace(/</g, "\\u003c");

    const wantsJson =
      String(req.query.format || "").toLowerCase() === "json" ||
      String(req.headers.accept || "").includes("application/json");

    if (wantsJson) {
      return res.json(payload);
    }

    return res.status(200).send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Google OAuth concluÃ­do</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
      main { max-width: 820px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
      h1 { margin-top: 0; font-size: 24px; }
      .ok { color: #166534; }
      .warn { color: #92400e; }
      pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 12px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
      code { font-family: Consolas, monospace; }
      .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; }
    </style>
  </head>
  <body>
    <main>
      <h1 class="${refreshToken ? "ok" : "warn"}">Google OAuth concluÃ­do</h1>
      <p>${escapeHtml(payload.message)}</p>
      ${state?.clienteId ? `<div class="box"><strong>Cliente</strong><p>${escapeHtml(state.clienteId)}</p></div>` : ""}
      ${googleAccountEmail ? `<div class="box"><strong>Conta Google</strong><p>${escapeHtml(googleAccountEmail)}</p></div>` : ""}
      <div class="box">
        <strong>Refresh token</strong>
        <pre><code>${escapeHtml(refreshToken || "NAO_RECEBIDO")}</code></pre>
      </div>
      <div class="box">
        <strong>Bloco para .env.local / Vercel</strong>
        <pre><code>${escapeHtml(envSnippet)}</code></pre>
      </div>
      <div class="box">
        <strong>ObservaÃ§Ã£o</strong>
        <p>Se o refresh token vier vazio, revogue o acesso do app Google autorizado anteriormente e repita o fluxo para forÃ§ar uma nova concessÃ£o offline.</p>
      </div>
    </main>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage(${popupMessage}, window.location.origin);
          window.close();
        }
      } catch (error) {
        console.error(error);
      }
    </script>
  </body>
</html>`);
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
      return res.json({ integracao: local });
    }

    const records = await supabaseRequest<ClienteIntegracao[]>(
      `cliente_integracoes?cliente_id=eq.${sanitizeId(cliente.id)}&select=*`,
    );
    res.json({ integracao: records[0] || { cliente_id: cliente.id, modo_operacao: "SIMULADOR" } });
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

    const payload: Partial<ClienteIntegracao> & { cliente_id: string } = {
      cliente_id: cliente.id,
      google_drive_folder_id: req.body.google_drive_folder_id ?? null,
      google_drive_imagens_folder_id: req.body.google_drive_imagens_folder_id ?? null,
      google_drive_videos_folder_id: req.body.google_drive_videos_folder_id ?? null,
      google_drive_publicados_folder_id: req.body.google_drive_publicados_folder_id ?? null,
      instagram_access_token: req.body.instagram_access_token ?? null,
      instagram_user_id: req.body.instagram_user_id ?? null,
      instagram_business_id: req.body.instagram_business_id ?? null,
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
      return res.json({ success: true, integracao: payload });
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

    await addLog("Clientes", "info", "IntegraÃ§Ãµes do cliente atualizadas.", { clienteId: cliente.id }, cliente.id);
    res.json({ success: true, integracao: result[0] || payload });
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

app.post("/api/clientes/:clienteId/integracoes/google-drive/testar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (!canEditClientSettings(actingUser)) {
      throw new HttpError(403, "UsuÃ¡rio sem permissÃ£o para testar integraÃ§Ãµes.");
    }
    const cliente = await getClienteById(req.params.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente nÃ£o encontrado." });
    const integracao = await getClienteIntegracao(cliente.id);
    const folderId =
      trimEnv(req.body?.google_drive_folder_id) ||
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





