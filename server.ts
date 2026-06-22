import { createHmac, createSign, randomUUID } from "crypto";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { HistoricoPost, LogMessage, PerfilPublicacao, Post, SettingsConfig, Usuario } from "./src/types";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "60mb" }));

type RuntimeMode = "SIMULATOR" | "REAL";

interface RuntimeConfig {
  appUrl: string;
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
  metaAppId: string;
  metaAppSecret: string;
  metaRedirectUri: string;
  instagramAccessToken: string;
  instagramBusinessId: string;
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

const defaultUsers: Usuario[] = [
  {
    id: "user-admin-cmoura",
    nome: "Carlos Moura",
    email: "cmourasiga@gmail.com",
    perfil: "ADMINISTRADOR",
    perfil_publicacao: "ADMIN",
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: "user-creator-juliana",
    nome: "Juliana Santos",
    email: "juliana@agencyflow.com",
    perfil: "USUARIO",
    perfil_publicacao: "CRIADOR",
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: "user-approver-operacoes",
    nome: "Mariana Lima",
    email: "mariana.aprovacao@agencyflow.com",
    perfil: "USUARIO",
    perfil_publicacao: "APROVADOR",
    ativo: true,
    criado_em: new Date().toISOString(),
  },
];

const memoryStore: MemoryStore = {
  posts: [],
  usuarios: [...defaultUsers],
  historicos: [],
  logs: [],
};

const REQUIRED_SUPABASE_TABLES = ["posts", "usuarios", "historico_posts", "logs"] as const;
const SCHEMA_CACHE_TTL_MS = 60_000;
let supabaseSchemaCache: SupabaseSchemaState | null = null;
let usuariosRoleColumnAvailableCache: boolean | null = null;
let usuariosColumnsCache: string[] | null = null;
const USER_ROLE_BY_EMAIL: Record<string, PerfilPublicacao> = {
  "cmourasiga@gmail.com": "ADMIN",
  "juliana@agencyflow.com": "CRIADOR",
  "mariana.aprovacao@agencyflow.com": "APROVADOR",
};

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não configurada.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "instaflow-manager",
        },
      },
    });
  }

  return aiClient;
}

function trimEnv(value?: string): string {
  return value?.trim() || "";
}

function normalizePrivateKey(value?: string): string {
  return trimEnv(value).replace(/\\n/g, "\n");
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

function getRuntimeConfig(): RuntimeConfig {
  const mode = trimEnv(process.env.APP_MODE).toUpperCase() === "REAL" ? "REAL" : "SIMULATOR";
  const supabaseUrl = trimEnv(process.env.SUPABASE_URL);
  const supabaseAnonKey = trimEnv(process.env.SUPABASE_ANON_KEY);
  const supabaseServiceRoleKey = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const googleDriveFolderId = trimEnv(process.env.GOOGLE_DRIVE_FOLDER_ID);
  const googleClientId = trimEnv(process.env.GOOGLE_CLIENT_ID);
  const googleClientSecret = trimEnv(process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGEL_SECRET_KEY);
  const googleRefreshToken = trimEnv(process.env.GOOGLE_REFRESH_TOKEN);
  const googleRedirectUri = trimEnv(process.env.GOOGLE_REDIRECT_URI);
  const googleClientEmail = trimEnv(process.env.GOOGLE_CLIENT_EMAIL);
  const googlePrivateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  const instagramAccessToken = trimEnv(process.env.INSTAGRAM_ACCESS_TOKEN);
  const instagramBusinessId = trimEnv(process.env.INSTAGRAM_BUSINESS_ID);
  const facebookPageId = trimEnv(process.env.FACEBOOK_PAGE_ID);
  const graphApiVersion = trimEnv(process.env.GRAPH_API_VERSION) || "v23.0";
  const metaAppId = trimEnv(process.env.META_APP_ID);
  const metaAppSecret = trimEnv(process.env.META_APP_SECRET);
  const metaRedirectUri = trimEnv(process.env.META_REDIRECT_URI);
  const metaVerifyToken = trimEnv(process.env.META_VERIFY_TOKEN);
  const appUrl = normalizeAppUrl(trimEnv(process.env.APP_URL));
  const geminiModel = trimEnv(process.env.GEMINI_MODEL) || "gemini-3.5-flash";
  const mediaUrlSigningSecret = trimEnv(process.env.MEDIA_URL_SIGNING_SECRET) || "local-media-secret";

  const supabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);
  const googleConfigured = Boolean(
    googleDriveFolderId &&
      ((googleClientEmail && googlePrivateKey) || (googleClientId && googleClientSecret && googleRefreshToken)),
  );
  const instagramConfigured = Boolean(instagramAccessToken && instagramBusinessId);
  const geminiConfigured = Boolean(trimEnv(process.env.GEMINI_API_KEY));

  const missingEnv: string[] = [];
  if (!supabaseConfigured) missingEnv.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseAnonKey) missingEnv.push("SUPABASE_ANON_KEY");
  if (!googleDriveFolderId) missingEnv.push("GOOGLE_DRIVE_FOLDER_ID");
  if (!(googleClientEmail && googlePrivateKey) && !(googleClientId && googleClientSecret && googleRefreshToken)) {
    missingEnv.push(
      "GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY ou GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN",
    );
  }
  if (!instagramAccessToken) missingEnv.push("INSTAGRAM_ACCESS_TOKEN");
  if (!instagramBusinessId) missingEnv.push("INSTAGRAM_BUSINESS_ID");

  const operationalMode: RuntimeMode =
    mode === "REAL" && supabaseConfigured && googleConfigured && instagramConfigured ? "REAL" : "SIMULATOR";

  return {
    appUrl,
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
    metaAppId,
    metaAppSecret,
    metaRedirectUri,
    instagramAccessToken,
    instagramBusinessId,
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

    throw new Error(`Falha ao validar schema do Supabase para '${table}': ${payload}`);
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

  const schema = await inspectSupabaseSchema();
  return schema.ready;
}

async function canUseRealMode(): Promise<boolean> {
  const config = getRuntimeConfig();
  if (config.operationalMode !== "REAL") {
    return false;
  }

  return canUseSupabase();
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
    USER_ROLE_BY_EMAIL[email.toLowerCase()] ||
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

async function getSettingsView(): Promise<SettingsConfig> {
  const config = getRuntimeConfig();
  const schemaState = await inspectSupabaseSchema();
  const operationalMode: RuntimeMode =
    config.mode === "REAL" && config.googleConfigured && config.instagramConfigured && schemaState.ready ? "REAL" : "SIMULATOR";

  return {
    mode: config.mode,
    operationalMode,
    appUrl: config.appUrl,
    supabaseUrl: config.supabaseUrl,
    supabaseConfigured: config.supabaseConfigured,
    supabaseSchemaReady: schemaState.ready,
    missingSupabaseTables: schemaState.missingTables,
    googleDriveFolderId: config.googleDriveFolderId,
    googleConfigured: config.googleConfigured,
    instagramBusinessId: config.instagramBusinessId,
    facebookPageId: config.facebookPageId,
    instagramConfigured: config.instagramConfigured,
    geminiModel: config.geminiModel,
    geminiConfigured: config.geminiConfigured,
    graphApiVersion: config.graphApiVersion,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePerfilPublicacao(user: Partial<Usuario>): PerfilPublicacao {
  const emailRole = USER_ROLE_BY_EMAIL[String(user.email || "").toLowerCase()];
  if (emailRole) {
    return emailRole;
  }

  if (user.perfil_publicacao === "CRIADOR" || user.perfil_publicacao === "APROVADOR" || user.perfil_publicacao === "ADMIN") {
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
  if (normalized === "APROVADOR") {
    return "APROVADOR";
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
    throw new Error("Supabase não configurado.");
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

async function listPosts(): Promise<Post[]> {
  if (!(await canUseSupabase())) {
    return [...memoryStore.posts].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }

  return supabaseRequest<Post[]>("posts?select=*&order=criado_em.desc");
}

async function getPostById(id: string): Promise<Post | null> {
  if (!(await canUseSupabase())) {
    return memoryStore.posts.find((post) => post.id === id) || null;
  }

  const records = await supabaseRequest<Post[]>(`posts?id=eq.${sanitizeId(id)}&select=*`);
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

async function updatePostRecord(id: string, patch: Partial<Post>): Promise<Post> {
  if (!(await canUseSupabase())) {
    const index = memoryStore.posts.findIndex((post) => post.id === id);
    if (index === -1) {
      throw new Error("Post não encontrado.");
    }
    memoryStore.posts[index] = { ...memoryStore.posts[index], ...patch };
    return memoryStore.posts[index];
  }

  const updated = await supabaseRequest<Post[]>(`posts?id=eq.${sanitizeId(id)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  if (!updated[0]) {
    throw new Error("Post não encontrado.");
  }

  return updated[0];
}

async function deletePostRecord(id: string): Promise<Post | null> {
  if (!(await canUseSupabase())) {
    const index = memoryStore.posts.findIndex((post) => post.id === id);
    if (index === -1) {
      return null;
    }
    const [deleted] = memoryStore.posts.splice(index, 1);
    return deleted;
  }

  const deleted = await supabaseRequest<Post[]>(`posts?id=eq.${sanitizeId(id)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation",
    },
  });

  return deleted[0] || null;
}

async function listHistory(): Promise<HistoricoPost[]> {
  if (!(await canUseSupabase())) {
    return [...memoryStore.historicos].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }

  return supabaseRequest<HistoricoPost[]>("historico_posts?select=*&order=criado_em.desc");
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

async function listLogs(): Promise<LogMessage[]> {
  if (!(await canUseSupabase())) {
    return [...memoryStore.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  try {
    return await supabaseRequest<LogMessage[]>("logs?select=*&order=timestamp.desc");
  } catch {
    return [...memoryStore.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
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

async function clearLogRecords(): Promise<void> {
  memoryStore.logs = [];

  if (!(await canUseSupabase())) {
    return;
  }

  try {
    await supabaseRequest<unknown>("logs?id=not.is.null", {
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

  const usersRaw = await supabaseRequest<Record<string, unknown>[]>(
    `usuarios?select=${selectColumns.join(",")}&order=${orderColumn}`,
  );
  const users = usersRaw.map(mapSupabaseUserRecord);
  const existingEmails = new Set(users.map((user) => user.email.toLowerCase()).filter(Boolean));
  const missingDefaults = defaultUsers.filter((user) => !existingEmails.has(user.email.toLowerCase()));
  const cmoura = users.find((user) => user.email.toLowerCase() === "cmourasiga@gmail.com");
  const cmouraNeedsAdminUpdate =
    cmoura &&
    (cmoura.perfil !== "ADMINISTRADOR" || normalizePerfilPublicacao(cmoura) !== "ADMIN");

  if (missingDefaults.length > 0 || cmouraNeedsAdminUpdate) {
    const payload = defaultUsers.map((user) => {
      const base = {
        nome: user.nome,
        email: user.email,
        perfil: roleColumnAvailable ? user.perfil : "OPERADOR",
      } as Record<string, unknown>;

      if (roleColumnAvailable) {
        base.perfil_publicacao = normalizePerfilPublicacao(user);
      }

      if (columns.includes("status")) {
        base.status = user.ativo ? "ATIVO" : "INATIVO";
      }

      if (columns.includes("ativo")) {
        base.ativo = user.ativo;
      }

      if (columns.includes("origem_dado")) {
        base.origem_dado = "SISTEMA";
      }

      if (columns.includes("criado_via_sistema")) {
        base.criado_via_sistema = true;
      }

      return base;
    });

    await supabaseRequest<Record<string, unknown>[]>("usuarios?on_conflict=email", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });
  }

  const finalUsersRaw = await supabaseRequest<Record<string, unknown>[]>(
    `usuarios?select=${selectColumns.join(",")}&order=${orderColumn}`,
  );
  return finalUsersRaw.map(mapSupabaseUserRecord);
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
    throw new HttpError(401, "Sessão inválida ou expirada. Faça login novamente.");
  }

  if (!response.ok) {
    throw new Error(`Falha ao validar sessão no Supabase Auth: ${await response.text()}`);
  }

  const user = (await response.json()) as { id?: string; email?: string };
  if (!user.id || !user.email) {
    throw new HttpError(401, "Sessão do Supabase sem identificação de usuário.");
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
): Promise<void> {
  await createLogRecord({
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
    normalizedName.endsWith(".mp4") ||
    normalizedName.endsWith(".mov") ||
    normalizedName.endsWith(".webm")
  ) {
    return "VIDEO";
  }
  return "IMAGEM";
}

function filenameToTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Post importado";
}

function getMediaProxyUrl(fileId: string): string {
  const config = getRuntimeConfig();
  const signature = createHmac("sha256", config.mediaUrlSigningSecret).update(fileId).digest("hex");
  return `${config.appUrl}/api/media/${encodeURIComponent(fileId)}?signature=${signature}`;
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
    throw new Error("Arquivo recebido em formato inválido.");
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

async function getGoogleAccessToken(): Promise<string> {
  const config = getRuntimeConfig();

  if (!config.googleConfigured) {
    throw new Error("Google Drive não configurado.");
  }

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

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: config.googleRefreshToken,
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

async function ensureDriveFolders(): Promise<DriveFolderMap> {
  const config = getRuntimeConfig();
  const imagensId = await findOrCreateDriveFolder("Imagens", config.googleDriveFolderId);
  const videosId = await findOrCreateDriveFolder("Videos", config.googleDriveFolderId);
  const publicadosId = await findOrCreateDriveFolder("Publicados", config.googleDriveFolderId);

  return {
    rootId: config.googleDriveFolderId,
    imagensId,
    videosId,
    publicadosId,
  };
}

async function uploadFileToGoogleDrive(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; url: string; folderName: string }> {
  const folders = await ensureDriveFolders();
  const isVideo = inferPostType(input.mimeType, input.filename) !== "IMAGEM";
  const parentId = isVideo ? folders.videosId : folders.imagensId;
  const folderName = isVideo ? "Videos" : "Imagens";
  const accessToken = await getGoogleAccessToken();
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
    url: getMediaProxyUrl(file.id),
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

async function moveDriveFileToPublishedFolder(fileId: string): Promise<void> {
  const folders = await ensureDriveFolders();
  const metadata = await googleDriveRequest<{ parents?: string[] }>(
    `files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`,
  );
  const removeParents = metadata.parents?.join(",") || "";
  const accessToken = await getGoogleAccessToken();
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

async function createInstagramContainer(post: Post): Promise<string> {
  const config = getRuntimeConfig();
  const body = new URLSearchParams({
    access_token: config.instagramAccessToken,
    caption: buildCaption(post),
  });

  if (post.tipo === "VIDEO" || post.tipo === "REELS") {
    if (!post.drive_url) {
      throw new Error("Vídeo sem URL pública para publicação.");
    }
    body.set("media_type", "REELS");
    body.set("video_url", post.drive_url);
  } else {
    if (!post.drive_url) {
      throw new Error("Imagem sem URL pública para publicação.");
    }
    body.set("image_url", post.drive_url);
  }

  const result = await metaGraphRequest<{ id: string }>(`/${config.instagramBusinessId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return result.id;
}

async function waitForContainerReady(containerId: string): Promise<void> {
  const config = getRuntimeConfig();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await metaGraphRequest<{ status_code?: string; status?: string }>(
      `/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(config.instagramAccessToken)}`,
    );

    const code = status.status_code || status.status;
    if (!code || code === "FINISHED" || code === "PUBLISHED") {
      return;
    }
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Container do Instagram retornou status ${code}.`);
    }

    await sleep(2000);
  }

  throw new Error("Tempo esgotado aguardando processamento da mídia no Instagram.");
}

async function publishInstagramContainer(creationId: string): Promise<{ mediaId: string; permalink?: string }> {
  const config = getRuntimeConfig();
  const publishBody = new URLSearchParams({
    creation_id: creationId,
    access_token: config.instagramAccessToken,
  });

  const published = await metaGraphRequest<{ id: string }>(`/${config.instagramBusinessId}/media_publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: publishBody,
  });

  let permalink: string | undefined;
  try {
    const media = await metaGraphRequest<{ permalink?: string }>(
      `/${published.id}?fields=permalink&access_token=${encodeURIComponent(config.instagramAccessToken)}`,
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
  await addLog("Instagram API", "info", `Iniciando publicação do post '${post.titulo}'.`, {
    postId: post.id,
    postType: post.tipo,
    businessId: getRuntimeConfig().instagramBusinessId,
  });

  if (!(await canUseRealMode())) {
    const simulated = await updatePostRecord(post.id, {
      status: "PUBLICADA",
      instagram_post_id: `sim_${Date.now()}`,
      data_publicacao: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      erro_detalhe: undefined,
    });

    await createHistoryRecord({
      post_id: simulated.id,
      post_titulo: simulated.titulo,
      usuario: author,
      acao: "Publicado",
      observacao: "Modo real indisponível. Publicação mantida apenas em sandbox operacional.",
      criado_em: new Date().toISOString(),
    });

    await addLog("Instagram API", "warn", "Publicação executada em sandbox por falta de configuração completa.", {
      missingEnv: getRuntimeConfig().missingEnv,
      missingTables: (await inspectSupabaseSchema()).missingTables,
    });

    return simulated;
  }

  const creationId = await createInstagramContainer(post);
  await addLog("Instagram API", "info", "Container de mídia criado na Meta.", {
    postId: post.id,
    creationId,
  });

  await updatePostRecord(post.id, {
    creation_id: creationId,
    status: "APROVADA",
    atualizado_em: new Date().toISOString(),
  });

  await waitForContainerReady(creationId);
  const published = await publishInstagramContainer(creationId);
  const next = await updatePostRecord(post.id, {
    status: "PUBLICADA",
    instagram_post_id: published.mediaId,
    data_publicacao: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    erro_detalhe: undefined,
  });

  await createHistoryRecord({
    post_id: next.id,
    post_titulo: next.titulo,
    usuario: author,
    acao: "Publicado",
    observacao: published.permalink
      ? `Publicação concluída com sucesso. Permalink: ${published.permalink}`
      : `Publicação concluída com sucesso. Media ID: ${published.mediaId}`,
    criado_em: new Date().toISOString(),
  });

  await addLog("Instagram API", "success", `Post '${next.titulo}' publicado com sucesso.`, {
    mediaId: published.mediaId,
    permalink: published.permalink,
  });

  if (next.drive_file_id) {
    try {
      await moveDriveFileToPublishedFolder(next.drive_file_id);
      await addLog("Google Drive", "info", "Mídia movida para a pasta Publicados.", {
        fileId: next.drive_file_id,
      });
    } catch (error) {
      await addLog("Google Drive", "warn", "Falha ao mover mídia para Publicados.", {
        fileId: next.drive_file_id,
        error: maskError(error),
      });
    }
  }

  return next;
}

async function importGoogleDrivePosts(author: string): Promise<Post[]> {
  const folders = await ensureDriveFolders();
  const [images, videos] = await Promise.all([
    listDriveFilesFromFolder(folders.imagensId),
    listDriveFilesFromFolder(folders.videosId),
  ]);

  const files = [...images, ...videos];
  const existingPosts = await listPosts();
  const existingDriveIds = new Set(existingPosts.map((post) => post.drive_file_id).filter(Boolean));
  const createdPosts: Post[] = [];

  for (const file of files) {
    if (existingDriveIds.has(file.id)) {
      continue;
    }

    const now = new Date().toISOString();
    const created = await createPostRecord({
      titulo: filenameToTitle(file.name),
      legenda: "",
      tipo: inferPostType(file.mimeType, file.name),
      drive_file_id: file.id,
      drive_url: getMediaProxyUrl(file.id),
      status: "PENDENTE",
      hashtags: "",
      criado_em: file.createdTime || now,
      atualizado_em: now,
      criado_por_nome: author,
    });

    await createHistoryRecord({
      post_id: created.id,
      post_titulo: created.titulo,
      usuario: author,
      acao: "Importado do Google Drive",
      observacao: `Arquivo '${file.name}' importado automaticamente da pasta monitorada.`,
      criado_em: now,
    });

    createdPosts.push(created);
  }

  await addLog("Google Drive", "success", "Importação do Google Drive concluída.", {
    imported: createdPosts.length,
  });

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
      post_id: post.id,
      post_titulo: post.titulo,
      usuario: "Scheduler",
      acao: "Aprovado",
      observacao: `Horário de agendamento atingido em ${now.toISOString()}.`,
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
      });
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
        `O usuário autenticado '${authUser.email}' não possui cadastro operacional ativo na tabela usuarios.`,
      );
    }

    if (!operationalUser.ativo) {
      throw new HttpError(403, `Usuário '${operationalUser.email}' está inativo.`);
    }

    return toActingUser(operationalUser);
  }

  const requestedEmail = getCurrentUserEmail(req.headers["x-user-email"]).trim().toLowerCase();
  const requestedName = getCurrentUserName(req.headers["x-user-name"], "").trim().toLowerCase();
  if (!requestedEmail && !requestedName) {
    throw new HttpError(401, "Autenticação obrigatória.");
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
    throw new Error("Nenhum usuário disponível na base de usuários.");
  }

  if (!match.ativo) {
    throw new Error(`Usuário '${match.email}' está inativo.`);
  }

  return toActingUser(match);
}

function canCreatePosts(user: ActingUser): boolean {
  return user.perfil_publicacao === "CRIADOR" || user.perfil_publicacao === "ADMIN";
}

function canApprovePosts(user: ActingUser): boolean {
  return user.perfil_publicacao === "APROVADOR" || user.perfil_publicacao === "ADMIN";
}

function assertCanCreatePosts(user: ActingUser) {
  if (!canCreatePosts(user)) {
    throw new HttpError(403, `Usuário '${user.email}' não possui permissão para criar publicações.`);
  }
}

function assertCanApprovePosts(user: ActingUser) {
  if (!canApprovePosts(user)) {
    throw new HttpError(403, `Usuário '${user.email}' não possui permissão para aprovar ou publicar.`);
  }
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
    res.json({ posts: await listPosts() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar posts.");
  }
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    const post = await getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post não encontrado." });
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
    const now = new Date().toISOString();
    const created = await createPostRecord({
      titulo: parseBody(req.body.titulo, "Sem Título"),
      legenda: parseBody(req.body.legenda, ""),
      tipo: inferPostType(req.body.tipo, req.body.filename),
      drive_file_id: req.body.drive_file_id || undefined,
      drive_url: req.body.drive_url || undefined,
      status: parseBody(req.body.status, "RASCUNHO"),
      hashtags: parseBody(req.body.hashtags, ""),
      criado_em: now,
      atualizado_em: now,
      criado_por_nome: actingUser.nome,
    });

    await createHistoryRecord({
      post_id: created.id,
      post_titulo: created.titulo,
      usuario: actingUser.nome,
      acao: created.status === "PENDENTE" ? "Envio para Aprovação" : "Criação de Post",
      observacao:
        created.status === "PENDENTE"
          ? "Post criado com mídia vinculada e enviado para aprovação."
          : "Post salvo como rascunho.",
      criado_em: now,
    });

    await addLog("Database", "success", `Novo post '${created.titulo}' persistido.`, {
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
    const existing = await getPostById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const actingUser = await getActingUserFromRequest(req);
    assertCanCreatePosts(actingUser);
    const next = await updatePostRecord(req.params.id, {
      titulo: req.body.titulo ?? existing.titulo,
      legenda: req.body.legenda ?? existing.legenda,
      hashtags: req.body.hashtags ?? existing.hashtags,
      drive_url: req.body.drive_url ?? existing.drive_url,
      drive_file_id: req.body.drive_file_id ?? existing.drive_file_id,
      data_agendamento: req.body.data_agendamento ?? existing.data_agendamento,
      status: req.body.status ?? existing.status,
      atualizado_em: new Date().toISOString(),
      erro_detalhe: req.body.erro_detalhe ?? existing.erro_detalhe,
    });

    await createHistoryRecord({
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Edição de Post",
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
    const deleted = await deletePostRecord(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    await createHistoryRecord({
      post_id: deleted.id,
      post_titulo: deleted.titulo,
      usuario: actingUser.nome,
      acao: "Remoção de Post",
      observacao: "Post excluído do sistema.",
      criado_em: new Date().toISOString(),
    });

    await addLog("Database", "warn", `Post '${deleted.titulo}' removido.`, {
      postId: deleted.id,
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
    const post = await getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const next = await updatePostRecord(req.params.id, {
      status: "PENDENTE",
      atualizado_em: new Date().toISOString(),
      erro_detalhe: undefined,
    });

    await createHistoryRecord({
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Envio para Aprovação",
      observacao: "Post encaminhado para moderação.",
      criado_em: new Date().toISOString(),
    });

    res.json({ success: true, post: next });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao enviar post para aprovação.");
  }
});

app.post("/api/posts/:id/reject", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const post = await getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const next = await updatePostRecord(req.params.id, {
      status: "REJEITADA",
      atualizado_em: new Date().toISOString(),
      erro_detalhe: undefined,
    });

    await createHistoryRecord({
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
    const post = await getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const action = req.body.action === "schedule" ? "schedule" : "instant";

    if (action === "schedule") {
      const appointmentTime = req.body.appointmentTime;
      if (!appointmentTime) {
        return res.status(400).json({ error: "appointmentTime é obrigatório para agendamento." });
      }

      const next = await updatePostRecord(req.params.id, {
        status: "AGENDADA",
        data_agendamento: appointmentTime,
        atualizado_em: new Date().toISOString(),
        erro_detalhe: undefined,
      });

      await createHistoryRecord({
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
      });

      return res.json({ success: true, post: next });
    }

    await createHistoryRecord({
      post_id: post.id,
      post_titulo: post.titulo,
      usuario: actingUser.nome,
      acao: "Aprovado",
      observacao: "Aprovação concedida para publicação imediata.",
      criado_em: new Date().toISOString(),
    });

    const published = await publishPost(post, actingUser.nome);
    res.json({ success: true, post: published });
  } catch (error) {
    if (req.params.id) {
      try {
        await updatePostRecord(req.params.id, {
          status: "ERRO",
          erro_detalhe: maskError(error),
          atualizado_em: new Date().toISOString(),
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
    const post = await getPostById(req.body.id);
    if (!post) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const action = req.body.action === "schedule" ? "schedule" : "instant";

    if (action === "schedule") {
      const appointmentTime = req.body.appointmentTime;
      if (!appointmentTime) {
        return res.status(400).json({ error: "appointmentTime é obrigatório para agendamento." });
      }

      const next = await updatePostRecord(post.id, {
        status: "AGENDADA",
        data_agendamento: appointmentTime,
        atualizado_em: new Date().toISOString(),
        erro_detalhe: undefined,
      });

      await createHistoryRecord({
        post_id: next.id,
        post_titulo: next.titulo,
        usuario: actingUser.nome,
        acao: "Agendado",
        observacao: `Post agendado para ${appointmentTime}.`,
        criado_em: new Date().toISOString(),
      });

      return res.json({ success: true, post: next });
    }

    const published = await publishPost(post, actingUser.nome);
    return res.json({ success: true, post: published });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao aprovar/publicar post.");
  }
});

app.post("/api/posts/rejeitar", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const post = await getPostById(req.body.id);
    if (!post) {
      return res.status(404).json({ error: "Post não encontrado." });
    }

    const next = await updatePostRecord(post.id, {
      status: "REJEITADA",
      atualizado_em: new Date().toISOString(),
      erro_detalhe: undefined,
    });

    await createHistoryRecord({
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
    const post = await getPostById(req.body.id);
    if (!post) {
      return res.status(404).json({ error: "Post não encontrado." });
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
    assertCanCreatePosts(actingUser);
    const filename = trimEnv(req.body.filename) || `upload-${Date.now()}`;
    const dataUrl = trimEnv(req.body.base64Data);
    const explicitMimeType = trimEnv(req.body.type) || "application/octet-stream";

    if (!dataUrl) {
      return res.status(400).json({ error: "base64Data é obrigatório." });
    }

    const parsed = dataUrlToBuffer(dataUrl);
    const mimeType = parsed.mimeType || explicitMimeType;

    await addLog("Google Drive", "info", `Recebido upload de '${filename}'.`, {
      filename,
      mimeType,
      sizeBytes: req.body.sizeBytes,
      mode: (await getSettingsView()).operationalMode,
    });

    if (!(await canUseRealMode())) {
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
    });

    await addLog("Google Drive", "success", `Upload concluído para '${filename}'.`, {
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

app.post("/api/google/upload", handleDriveUpload);
app.post("/api/simulate-drive-upload", handleDriveUpload);

app.get("/api/media/:fileId", async (req, res) => {
  try {
    if (!verifyMediaSignature(req.params.fileId, String(req.query.signature || ""))) {
      return res.status(403).json({ error: "Assinatura de mídia inválida." });
    }

    if (!(await canUseRealMode())) {
      return res.status(404).json({ error: "Mídia não disponível fora do modo real." });
    }

    const accessToken = await getGoogleAccessToken();
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
    respondWithError(res, error, "Google Drive", "Falha ao servir mídia do Google Drive.", 502);
  }
});

app.get("/api/google/oauth/start", (req, res) => {
  const config = getRuntimeConfig();
  if (!config.googleClientId || !config.googleRedirectUri) {
    return res.status(400).json({ error: "GOOGLE_CLIENT_ID e GOOGLE_REDIRECT_URI são obrigatórios." });
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.googleClientId);
  url.searchParams.set("redirect_uri", config.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/drive");

  res.redirect(url.toString());
});

app.get("/api/google/oauth/callback", async (req, res) => {
  try {
    const config = getRuntimeConfig();
    const code = trimEnv(String(req.query.code || ""));
    if (!code) {
      return res.status(400).json({ error: "Parâmetro code ausente." });
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
    const envSnippet = [
      `GOOGLE_CLIENT_ID=${config.googleClientId}`,
      `GOOGLE_CLIENT_SECRET=${config.googleClientSecret}`,
      `GOOGLE_REFRESH_TOKEN=${refreshToken}`,
      `GOOGLE_REDIRECT_URI=${config.googleRedirectUri}`,
      `GOOGLE_DRIVE_FOLDER_ID=${config.googleDriveFolderId}`,
    ].join("\n");

    const payload = {
      success: true,
      message: refreshToken
        ? "Callback Google concluído. Salve o refresh_token nas variáveis de ambiente."
        : "Callback Google concluído, mas o Google não retornou refresh_token. Revogue o acesso do app e repita com prompt=consent.",
      refreshToken,
      envSnippet,
      tokens,
    };

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
    <title>Google OAuth concluído</title>
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
      <h1 class="${refreshToken ? "ok" : "warn"}">Google OAuth concluído</h1>
      <p>${escapeHtml(payload.message)}</p>
      <div class="box">
        <strong>Refresh token</strong>
        <pre><code>${escapeHtml(refreshToken || "NAO_RECEBIDO")}</code></pre>
      </div>
      <div class="box">
        <strong>Bloco para .env.local / Vercel</strong>
        <pre><code>${escapeHtml(envSnippet)}</code></pre>
      </div>
      <div class="box">
        <strong>Observação</strong>
        <p>Se o refresh token vier vazio, revogue o acesso do app Google autorizado anteriormente e repita o fluxo para forçar uma nova concessão offline.</p>
      </div>
    </main>
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
    const imported = await importGoogleDrivePosts(actingUser.nome);
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
    return res.status(400).json({ error: "META_APP_ID e META_REDIRECT_URI são obrigatórios." });
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
      return res.status(400).json({ error: "Parâmetro code ausente." });
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
      message: "Callback Meta concluído. Salve os valores abaixo no ambiente da aplicação.",
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
    respondWithError(res, error, "Scheduler", "Falha ao processar publicações agendadas.");
  }
});

app.get("/api/history", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    res.json({ history: await listHistory() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar histórico.");
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    res.json({ logs: await listLogs() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar logs.");
  }
});

app.post("/api/logs/clear", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    await clearLogRecords();
    await addLog("Database", "info", "Logs limpos pelo painel.");
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao limpar logs.");
  }
});

app.get("/api/public-config", (_req, res) => {
  try {
    res.json({ config: getPublicRuntimeConfig() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao carregar configuração pública.", 500);
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    res.json({ user: await getActingUserFromRequest(req) });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao validar usuário autenticado.", 401);
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    res.json({ settings: await getSettingsView() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao ler estado das integrações.");
  }
});

app.post("/api/settings", (_req, res) => {
  res.status(405).json({
    success: false,
    error: "As integrações agora são configuradas exclusivamente por variáveis de ambiente no backend.",
  });
});

app.get("/api/users", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    res.json({ users: await listUsers() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar usuários.");
  }
});

app.post("/api/gemini/generate-caption", async (req, res) => {
  const { title, prompt, type, hashtagsCount } = req.body;
  const count = Number(hashtagsCount) || 5;

  try {
    await getActingUserFromRequest(req);
    const ai = getGeminiClient();
    await addLog("Gemini AI", "info", "Gerando legenda com Gemini.", {
      title,
      prompt,
      type,
      model: getRuntimeConfig().geminiModel,
    });

    const response = await ai.models.generateContent({
      model: getRuntimeConfig().geminiModel,
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
      legenda: `${title}\n\n${prompt || "Conteúdo preparado para revisão e publicação no Instagram."}`,
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
    await addLog("Database", "warn", "Falha ao validar base de usuários durante o bootstrap.", {
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
