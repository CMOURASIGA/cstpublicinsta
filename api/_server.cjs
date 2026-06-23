var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default,
  initializeApp: () => initializeApp
});
module.exports = __toCommonJS(server_exports);
var import_crypto = require("crypto");
var import_express = __toESM(require("express"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_path = __toESM(require("path"), 1);
var import_genai = require("@google/genai");
import_dotenv.default.config({ path: import_path.default.join(process.cwd(), ".env.local") });
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = Number(process.env.PORT || 3e3);
app.use(import_express.default.json({ limit: "60mb" }));
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var defaultUsers = [
  {
    id: "user-admin-cmoura",
    nome: "Christian Moura",
    email: "cmourasiga@gmail.com",
    perfil: "ADMINISTRADOR",
    perfil_publicacao: "ADMIN",
    ativo: true,
    criado_em: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var memoryStore = {
  posts: [],
  usuarios: [...defaultUsers],
  historicos: [],
  logs: []
};
var REQUIRED_SUPABASE_TABLES = ["posts", "usuarios", "historico_posts", "logs"];
var SCHEMA_CACHE_TTL_MS = 6e4;
var supabaseSchemaCache = null;
var usuariosRoleColumnAvailableCache = null;
var usuariosColumnsCache = null;
var aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY n\xE3o configurada.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "instaflow-manager"
        }
      }
    });
  }
  return aiClient;
}
function trimEnv(value) {
  return value?.trim() || "";
}
function normalizePrivateKey(value) {
  return trimEnv(value).replace(/\\n/g, "\n");
}
function normalizeAppUrl(rawUrl) {
  const fallback = `http://localhost:${PORT}`;
  const source = rawUrl || fallback;
  try {
    return new URL(source).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}
function getRuntimeConfig() {
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
  const instagramUserId = trimEnv(process.env.INSTAGRAM_USER_ID);
  const instagramBusinessId = trimEnv(process.env.INSTAGRAM_BUSINESS_ID);
  const instagramGraphBaseUrl = trimEnv(process.env.INSTAGRAM_GRAPH_BASE_URL) || "https://graph.facebook.com";
  const facebookPageId = trimEnv(process.env.FACEBOOK_PAGE_ID);
  const graphApiVersion = trimEnv(process.env.GRAPH_API_VERSION) || "v23.0";
  const metaAppId = trimEnv(process.env.META_APP_ID);
  const metaAppSecret = trimEnv(process.env.META_APP_SECRET);
  const metaRedirectUri = trimEnv(process.env.META_REDIRECT_URI);
  const metaVerifyToken = trimEnv(process.env.META_VERIFY_TOKEN);
  const n8nApprovalWebhookUrl = trimEnv(process.env.N8N_APPROVAL_WEBHOOK_URL);
  const appUrl = normalizeAppUrl(trimEnv(process.env.APP_URL));
  const geminiModel = trimEnv(process.env.GEMINI_MODEL) || "gemini-3.5-flash";
  const mediaUrlSigningSecret = trimEnv(process.env.MEDIA_URL_SIGNING_SECRET) || "local-media-secret";
  const supabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);
  const googleConfigured = Boolean(
    googleDriveFolderId && (googleClientEmail && googlePrivateKey || googleClientId && googleClientSecret && googleRefreshToken)
  );
  const instagramConfigured = Boolean(instagramAccessToken && (instagramUserId || instagramBusinessId));
  const geminiConfigured = Boolean(trimEnv(process.env.GEMINI_API_KEY));
  const missingEnv = [];
  if (!supabaseConfigured) missingEnv.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseAnonKey) missingEnv.push("SUPABASE_ANON_KEY");
  if (!googleDriveFolderId) missingEnv.push("GOOGLE_DRIVE_FOLDER_ID");
  if (!(googleClientEmail && googlePrivateKey) && !(googleClientId && googleClientSecret && googleRefreshToken)) {
    missingEnv.push(
      "GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY ou GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN"
    );
  }
  if (!instagramAccessToken) missingEnv.push("INSTAGRAM_ACCESS_TOKEN");
  if (!instagramUserId && !instagramBusinessId) missingEnv.push("INSTAGRAM_USER_ID ou INSTAGRAM_BUSINESS_ID");
  const operationalMode = mode === "REAL" && supabaseConfigured && googleConfigured && instagramConfigured ? "REAL" : "SIMULATOR";
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
    instagramUserId,
    instagramBusinessId,
    instagramGraphBaseUrl,
    facebookPageId,
    metaVerifyToken,
    n8nApprovalWebhookUrl,
    mediaUrlSigningSecret,
    supabaseConfigured,
    googleConfigured,
    instagramConfigured,
    geminiConfigured,
    missingEnv: [...new Set(missingEnv)]
  };
}
async function inspectSupabaseSchema(forceRefresh = false) {
  const config = getRuntimeConfig();
  const now = Date.now();
  if (!config.supabaseConfigured) {
    return {
      ready: false,
      missingTables: [...REQUIRED_SUPABASE_TABLES],
      checkedAt: now
    };
  }
  if (!forceRefresh && supabaseSchemaCache && now - supabaseSchemaCache.checkedAt < SCHEMA_CACHE_TTL_MS) {
    return supabaseSchemaCache;
  }
  const missingTables = [];
  for (const table of REQUIRED_SUPABASE_TABLES) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`
      }
    });
    if (response.ok) {
      continue;
    }
    const payload = await response.text();
    if (payload.includes("PGRST205")) {
      missingTables.push(table);
      continue;
    }
    if (payload.includes('"code":"42501"')) {
      missingTables.push(`${table} (permiss\xE3o service_role ausente)`);
      continue;
    }
    throw new Error(`Falha ao validar schema do Supabase para '${table}': ${payload}`);
  }
  supabaseSchemaCache = {
    ready: missingTables.length === 0,
    missingTables,
    checkedAt: now
  };
  return supabaseSchemaCache;
}
async function canUseSupabase() {
  const config = getRuntimeConfig();
  if (!config.supabaseConfigured) {
    return false;
  }
  const schema = await inspectSupabaseSchema();
  return schema.ready;
}
async function canUseRealMode() {
  const config = getRuntimeConfig();
  if (config.operationalMode !== "REAL") {
    return false;
  }
  return canUseSupabase();
}
async function hasUsuariosRoleColumn() {
  const columns = await getUsuariosColumns();
  usuariosRoleColumnAvailableCache = columns.includes("perfil_publicacao");
  return usuariosRoleColumnAvailableCache;
}
async function getUsuariosColumns() {
  if (usuariosColumnsCache) {
    return usuariosColumnsCache;
  }
  const config = getRuntimeConfig();
  if (!await canUseSupabase()) {
    return [];
  }
  const response = await fetch(`${config.supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      Accept: "application/openapi+json"
    }
  });
  if (!response.ok) {
    throw new Error(`Falha ao ler metadata do schema de usuarios: ${await response.text()}`);
  }
  const openapi = await response.json();
  usuariosColumnsCache = Object.keys(openapi.definitions?.usuarios?.properties || {});
  return usuariosColumnsCache;
}
function mapSupabaseUserRecord(record) {
  const email = String(record.email || "");
  const perfil = inferPerfilFromRawValue(record.perfil);
  const perfil_publicacao = inferPerfilPublicacaoFromRawValue(record.perfil_publicacao, record.perfil) || (perfil === "ADMINISTRADOR" ? "ADMIN" : "CRIADOR");
  return {
    id: String(record.id || (0, import_crypto.randomUUID)()),
    auth_user_id: record.auth_user_id ? String(record.auth_user_id) : void 0,
    nome: String(record.nome || ""),
    email,
    perfil,
    perfil_publicacao,
    ativo: record.ativo === void 0 ? String(record.status || "ATIVO").toUpperCase() !== "INATIVO" : Boolean(record.ativo),
    criado_em: String(record.criado_em || (/* @__PURE__ */ new Date()).toISOString())
  };
}
async function getSettingsView() {
  const config = getRuntimeConfig();
  const schemaState = await inspectSupabaseSchema();
  const operationalMode = config.mode === "REAL" && config.googleConfigured && config.instagramConfigured && schemaState.ready ? "REAL" : "SIMULATOR";
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
    instagramBusinessId: config.instagramUserId || config.instagramBusinessId,
    instagramGraphBaseUrl: config.instagramGraphBaseUrl,
    facebookPageId: config.facebookPageId,
    instagramConfigured: config.instagramConfigured,
    geminiModel: config.geminiModel,
    geminiConfigured: config.geminiConfigured,
    graphApiVersion: config.graphApiVersion,
    secretsStoredInBackend: true,
    readOnly: true,
    missingEnv: config.missingEnv
  };
}
function getPublicRuntimeConfig() {
  const config = getRuntimeConfig();
  return {
    appUrl: config.appUrl,
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey
  };
}
function toJsonString(payload) {
  if (payload === void 0) return void 0;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}
function maskError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
function assertPostMediaValidation(payload, post) {
  if (!post.drive_url) {
    throw new HttpError(400, "A postagem precisa ter uma m\xEDdia p\xFAblica vinculada antes da publica\xE7\xE3o.");
  }
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "A valida\xE7\xE3o da m\xEDdia \xE9 obrigat\xF3ria antes de agendar ou publicar.");
  }
  const candidate = payload;
  const width = typeof candidate.width === "number" ? candidate.width : Number(candidate.width);
  const height = typeof candidate.height === "number" ? candidate.height : Number(candidate.height);
  const aspectRatio = typeof candidate.aspectRatio === "number" ? candidate.aspectRatio : Number(candidate.aspectRatio);
  const isFeedCompatible = candidate.isFeedCompatible === true;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(aspectRatio)) {
    throw new HttpError(400, "A valida\xE7\xE3o da m\xEDdia retornou dimens\xF5es inv\xE1lidas.");
  }
  if (!isFeedCompatible) {
    throw new HttpError(400, "A m\xEDdia n\xE3o passou na valida\xE7\xE3o para o feed do Instagram.");
  }
  if (post.tipo === "REELS") {
    if (aspectRatio < 0.56 || aspectRatio > 0.8) {
      throw new HttpError(400, "Reels devem estar entre 9:16 e 4:5 para publica\xE7\xE3o consistente.");
    }
    return;
  }
  if (aspectRatio < 0.8 || aspectRatio > 1.91) {
    throw new HttpError(400, "Posts de feed devem usar propor\xE7\xE3o entre 4:5 e 1.91:1.");
  }
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function normalizePerfilPublicacao(user) {
  if (user.perfil_publicacao === "CRIADOR" || user.perfil_publicacao === "APROVADOR" || user.perfil_publicacao === "ADMIN") {
    return user.perfil_publicacao;
  }
  if (user.perfil === "ADMINISTRADOR") {
    return "ADMIN";
  }
  return "CRIADOR";
}
function toActingUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    perfil_publicacao: normalizePerfilPublicacao(user),
    ativo: user.ativo
  };
}
function inferPerfilFromRawValue(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "ADMIN" || normalized === "ADMINISTRADOR") {
    return "ADMINISTRADOR";
  }
  return "USUARIO";
}
function inferPerfilPublicacaoFromRawValue(value, fallbackPerfil) {
  const normalized = String(value || fallbackPerfil || "").toUpperCase();
  if (normalized === "ADMIN" || normalized === "ADMINISTRADOR") {
    return "ADMIN";
  }
  if (normalized === "APROVADOR") {
    return "APROVADOR";
  }
  return "CRIADOR";
}
function sanitizeId(value) {
  return encodeURIComponent(value);
}
async function safeParseJson(response) {
  const text = await response.text();
  if (!text) {
    return [];
  }
  return JSON.parse(text);
}
async function supabaseRequest(resource, init) {
  const config = getRuntimeConfig();
  if (!await canUseSupabase()) {
    throw new Error("Supabase n\xE3o configurado.");
  }
  const headers = new Headers(init?.headers);
  headers.set("apikey", config.supabaseServiceRoleKey);
  headers.set("Authorization", `Bearer ${config.supabaseServiceRoleKey}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${resource}`, {
    ...init,
    headers
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  return safeParseJson(response);
}
async function listPosts() {
  if (!await canUseSupabase()) {
    return [...memoryStore.posts].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }
  return supabaseRequest("posts?select=*&order=criado_em.desc");
}
async function getPostById(id) {
  if (!await canUseSupabase()) {
    return memoryStore.posts.find((post) => post.id === id) || null;
  }
  const records = await supabaseRequest(`posts?id=eq.${sanitizeId(id)}&select=*`);
  return records[0] || null;
}
async function createPostRecord(payload) {
  if (!await canUseSupabase()) {
    const record = { id: (0, import_crypto.randomUUID)(), ...payload };
    memoryStore.posts.unshift(record);
    return record;
  }
  const created = await supabaseRequest("posts", {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  return created[0];
}
async function updatePostRecord(id, patch) {
  if (!await canUseSupabase()) {
    const index = memoryStore.posts.findIndex((post) => post.id === id);
    if (index === -1) {
      throw new Error("Post n\xE3o encontrado.");
    }
    memoryStore.posts[index] = { ...memoryStore.posts[index], ...patch };
    return memoryStore.posts[index];
  }
  const updated = await supabaseRequest(`posts?id=eq.${sanitizeId(id)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(patch)
  });
  if (!updated[0]) {
    throw new Error("Post n\xE3o encontrado.");
  }
  return updated[0];
}
async function deletePostRecord(id) {
  if (!await canUseSupabase()) {
    const index = memoryStore.posts.findIndex((post) => post.id === id);
    if (index === -1) {
      return null;
    }
    const [deleted2] = memoryStore.posts.splice(index, 1);
    return deleted2;
  }
  const deleted = await supabaseRequest(`posts?id=eq.${sanitizeId(id)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation"
    }
  });
  return deleted[0] || null;
}
async function listHistory() {
  if (!await canUseSupabase()) {
    return [...memoryStore.historicos].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }
  return supabaseRequest("historico_posts?select=*&order=criado_em.desc");
}
async function createHistoryRecord(payload) {
  if (!await canUseSupabase()) {
    const record = { id: (0, import_crypto.randomUUID)(), ...payload };
    memoryStore.historicos.unshift(record);
    return record;
  }
  const created = await supabaseRequest("historico_posts", {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  return created[0];
}
async function listLogs() {
  if (!await canUseSupabase()) {
    return [...memoryStore.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  try {
    return await supabaseRequest("logs?select=*&order=timestamp.desc");
  } catch {
    return [...memoryStore.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}
async function createLogRecord(payload) {
  if (!await canUseSupabase()) {
    const record = { id: (0, import_crypto.randomUUID)(), ...payload };
    memoryStore.logs.unshift(record);
    memoryStore.logs = memoryStore.logs.slice(0, 200);
    return record;
  }
  try {
    const created = await supabaseRequest("logs", {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });
    return created[0];
  } catch {
    const record = { id: (0, import_crypto.randomUUID)(), ...payload };
    memoryStore.logs.unshift(record);
    memoryStore.logs = memoryStore.logs.slice(0, 200);
    return record;
  }
}
async function clearLogRecords() {
  memoryStore.logs = [];
  if (!await canUseSupabase()) {
    return;
  }
  try {
    await supabaseRequest("logs?id=not.is.null", {
      method: "DELETE"
    });
  } catch {
  }
}
async function listUsers() {
  if (!await canUseSupabase()) {
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
  const finalUsersRaw = await supabaseRequest(
    `usuarios?select=${selectColumns.join(",")}&order=${orderColumn}`
  );
  return finalUsersRaw.map(mapSupabaseUserRecord);
}
async function updateUserRecord(id, patch) {
  if (!await canUseSupabase()) {
    const index = memoryStore.usuarios.findIndex((user) => user.id === id);
    if (index === -1) {
      throw new Error("Usu\xE1rio n\xE3o encontrado.");
    }
    memoryStore.usuarios[index] = {
      ...memoryStore.usuarios[index],
      ...patch
    };
    return memoryStore.usuarios[index];
  }
  const columns = await getUsuariosColumns();
  const payload = {
    atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (patch.nome !== void 0) payload.nome = patch.nome;
  if (patch.email !== void 0) payload.email = patch.email;
  if (patch.perfil !== void 0) payload.perfil = patch.perfil;
  if (patch.perfil_publicacao !== void 0 && columns.includes("perfil_publicacao")) {
    payload.perfil_publicacao = patch.perfil_publicacao;
  }
  if (patch.ativo !== void 0 && columns.includes("ativo")) {
    payload.ativo = patch.ativo;
  }
  if (patch.ativo !== void 0 && columns.includes("status")) {
    payload.status = patch.ativo ? "ATIVO" : "INATIVO";
  }
  const updated = await supabaseRequest(
    `usuarios?id=eq.${sanitizeId(id)}&select=*`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    }
  );
  if (!updated[0]) {
    throw new Error("Usu\xE1rio n\xE3o encontrado.");
  }
  usuariosColumnsCache = null;
  return mapSupabaseUserRecord(updated[0]);
}
async function createOperationalUserRecord(payload) {
  if (!await canUseSupabase()) {
    const record = {
      id: (0, import_crypto.randomUUID)(),
      nome: payload.nome,
      email: payload.email,
      perfil: payload.perfil_publicacao === "ADMIN" ? "ADMINISTRADOR" : "USUARIO",
      perfil_publicacao: payload.perfil_publicacao,
      ativo: payload.ativo,
      criado_em: (/* @__PURE__ */ new Date()).toISOString(),
      auth_user_id: payload.auth_user_id
    };
    memoryStore.usuarios.push(record);
    return record;
  }
  const columns = await getUsuariosColumns();
  const body = {
    nome: payload.nome,
    email: payload.email,
    perfil: payload.perfil_publicacao === "ADMIN" ? "ADMIN" : "OPERADOR",
    atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
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
  const created = await supabaseRequest("usuarios", {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(body)
  });
  if (!created[0]) {
    throw new Error("Falha ao criar usu\xE1rio operacional.");
  }
  usuariosColumnsCache = null;
  return mapSupabaseUserRecord(created[0]);
}
async function deleteOperationalUserRecord(id) {
  if (!await canUseSupabase()) {
    const index = memoryStore.usuarios.findIndex((user) => user.id === id);
    if (index === -1) {
      return null;
    }
    const [deleted2] = memoryStore.usuarios.splice(index, 1);
    return deleted2;
  }
  const deleted = await supabaseRequest(`usuarios?id=eq.${sanitizeId(id)}&select=*`, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation"
    }
  });
  usuariosColumnsCache = null;
  return deleted[0] ? mapSupabaseUserRecord(deleted[0]) : null;
}
async function createSupabaseAuthUser(payload) {
  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        nome: payload.nome
      }
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Falha ao criar usu\xE1rio no Supabase Auth: ${text}`);
  }
  const data = JSON.parse(text);
  const authUserId = data.user?.id || data.id;
  if (!authUserId) {
    throw new Error("Supabase Auth n\xE3o retornou o ID do usu\xE1rio criado.");
  }
  return authUserId;
}
async function deleteSupabaseAuthUser(authUserId) {
  if (!authUserId) {
    return;
  }
  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "DELETE",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Falha ao excluir usu\xE1rio no Supabase Auth: ${await response.text()}`);
  }
}
async function updateSupabaseAuthUser(authUserId, payload) {
  if (!authUserId) {
    throw new Error("Usu\xE1rio sem v\xEDnculo com Supabase Auth.");
  }
  const body = {};
  if (payload.email) body.email = payload.email;
  if (payload.password) body.password = payload.password;
  if (payload.nome) {
    body.user_metadata = {
      nome: payload.nome
    };
  }
  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "PUT",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Falha ao atualizar usu\xE1rio no Supabase Auth: ${await response.text()}`);
  }
}
function getAuthorizationToken(headerValue) {
  const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const match = (rawValue || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}
async function fetchSupabaseAuthUser(accessToken) {
  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.supabaseAnonKey || config.supabaseServiceRoleKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(401, "Sess\xE3o inv\xE1lida ou expirada. Fa\xE7a login novamente.");
  }
  if (!response.ok) {
    throw new Error(`Falha ao validar sess\xE3o no Supabase Auth: ${await response.text()}`);
  }
  const user = await response.json();
  if (!user.id || !user.email) {
    throw new HttpError(401, "Sess\xE3o do Supabase sem identifica\xE7\xE3o de usu\xE1rio.");
  }
  return {
    id: user.id,
    email: user.email
  };
}
async function linkOperationalUserToAuthIdentity(userId, authUserId) {
  const columns = await getUsuariosColumns();
  if (!columns.includes("auth_user_id")) {
    return;
  }
  await supabaseRequest(`usuarios?id=eq.${sanitizeId(userId)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      auth_user_id: authUserId,
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
    })
  });
}
async function findOperationalUserByAuthIdentity(authUser) {
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
      auth_user_id: authUser.id
    };
  }
  return emailUser;
}
async function addLog(service, type, message, payload) {
  await createLogRecord({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    service,
    type,
    message,
    payload: toJsonString(payload)
  });
}
function buildCaption(post) {
  const base = post.legenda?.trim() || post.titulo;
  const hashtags = post.hashtags?.trim();
  return hashtags ? `${base}

${hashtags}` : base;
}
function inferPostType(mimeType, filename) {
  const normalizedMime = (mimeType || "").toLowerCase();
  const normalizedName = (filename || "").toLowerCase();
  if (normalizedMime.startsWith("video/") || normalizedName.endsWith(".mp4") || normalizedName.endsWith(".mov") || normalizedName.endsWith(".webm")) {
    return "VIDEO";
  }
  return "IMAGEM";
}
function filenameToTitle(filename) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Post importado";
}
function getMediaProxyUrl(fileId) {
  const config = getRuntimeConfig();
  const signature = (0, import_crypto.createHmac)("sha256", config.mediaUrlSigningSecret).update(fileId).digest("hex");
  return `${config.appUrl}/api/media/${encodeURIComponent(fileId)}?signature=${signature}`;
}
function verifyMediaSignature(fileId, signature) {
  if (!signature) return false;
  const config = getRuntimeConfig();
  const expected = (0, import_crypto.createHmac)("sha256", config.mediaUrlSigningSecret).update(fileId).digest("hex");
  return signature === expected;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("Arquivo recebido em formato inv\xE1lido.");
  }
  return {
    mimeType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64")
  };
}
function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function getGoogleAccessToken() {
  const config = getRuntimeConfig();
  if (!config.googleConfigured) {
    throw new Error("Google Drive n\xE3o configurado.");
  }
  if (config.googleClientEmail && config.googlePrivateKey) {
    const now = Math.floor(Date.now() / 1e3);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claimSet = base64UrlEncode(
      JSON.stringify({
        iss: config.googleClientEmail,
        scope: "https://www.googleapis.com/auth/drive",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now
      })
    );
    const unsigned = `${header}.${claimSet}`;
    const signer = (0, import_crypto.createSign)("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(config.googlePrivateKey);
    const assertion = `${unsigned}.${base64UrlEncode(signature)}`;
    const response2 = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });
    if (!response2.ok) {
      throw new Error(`Falha ao autenticar service account: ${await response2.text()}`);
    }
    const json2 = await response2.json();
    return json2.access_token;
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: config.googleRefreshToken,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) {
    throw new Error(`Falha ao atualizar token do Google: ${await response.text()}`);
  }
  const json = await response.json();
  return json.access_token;
}
async function googleDriveRequest(resource, init) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/${resource}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers || {}
    }
  });
  if (!response.ok) {
    throw new Error(`Google Drive ${response.status}: ${await response.text()}`);
  }
  return safeParseJson(response);
}
async function findOrCreateDriveFolder(name, parentId) {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${name}' and '${parentId}' in parents`
  );
  const existing = await googleDriveRequest(
    `files?q=${query}&fields=files(id)&includeItemsFromAllDrives=true&supportsAllDrives=true`
  );
  if (existing.files[0]?.id) {
    return existing.files[0].id;
  }
  const accessToken = await getGoogleAccessToken();
  const response = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    })
  });
  if (!response.ok) {
    throw new Error(`Falha ao criar pasta ${name}: ${await response.text()}`);
  }
  const json = await response.json();
  return json.id;
}
async function ensureDriveFolders() {
  const config = getRuntimeConfig();
  const imagensId = await findOrCreateDriveFolder("Imagens", config.googleDriveFolderId);
  const videosId = await findOrCreateDriveFolder("Videos", config.googleDriveFolderId);
  const publicadosId = await findOrCreateDriveFolder("Publicados", config.googleDriveFolderId);
  return {
    rootId: config.googleDriveFolderId,
    imagensId,
    videosId,
    publicadosId
  };
}
async function uploadFileToGoogleDrive(input) {
  const folders = await ensureDriveFolders();
  const isVideo = inferPostType(input.mimeType, input.filename) !== "IMAGEM";
  const parentId = isVideo ? folders.videosId : folders.imagensId;
  const folderName = isVideo ? "Videos" : "Imagens";
  const accessToken = await getGoogleAccessToken();
  const boundary = `instaflow-${Date.now()}`;
  const metadata = {
    name: input.filename,
    parents: [parentId]
  };
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r
Content-Type: application/json; charset=UTF-8\r
\r
${JSON.stringify(metadata)}\r
`),
    Buffer.from(`--${boundary}\r
Content-Type: ${input.mimeType}\r
\r
`),
    input.buffer,
    Buffer.from(`\r
--${boundary}--`)
  ]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });
  if (!response.ok) {
    throw new Error(`Falha no upload ao Google Drive: ${await response.text()}`);
  }
  const file = await response.json();
  return {
    fileId: file.id,
    url: getMediaProxyUrl(file.id),
    folderName
  };
}
async function listDriveFilesFromFolder(folderId) {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const response = await googleDriveRequest(
    `files?q=${query}&fields=files(id,name,mimeType,createdTime)&includeItemsFromAllDrives=true&supportsAllDrives=true`
  );
  return response.files.filter((file) => {
    const type = inferPostType(file.mimeType, file.name);
    return type === "IMAGEM" || type === "VIDEO";
  });
}
async function moveDriveFileToPublishedFolder(fileId) {
  const folders = await ensureDriveFolders();
  const metadata = await googleDriveRequest(
    `files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`
  );
  const removeParents = metadata.parents?.join(",") || "";
  const accessToken = await getGoogleAccessToken();
  const params = new URLSearchParams({
    addParents: folders.publicadosId,
    supportsAllDrives: "true"
  });
  if (removeParents) {
    params.set("removeParents", removeParents);
  }
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    throw new Error(`Falha ao mover arquivo para Publicados: ${await response.text()}`);
  }
}
async function metaGraphRequest(resource, init) {
  const config = getRuntimeConfig();
  const response = await fetch(`https://graph.facebook.com/${config.graphApiVersion}${resource}`, init);
  if (!response.ok) {
    throw new Error(`Meta Graph ${response.status}: ${await response.text()}`);
  }
  return safeParseJson(response);
}
function getInstagramPublishingActorId() {
  const config = getRuntimeConfig();
  return config.instagramUserId || config.instagramBusinessId;
}
async function instagramGraphRequest(resource, init) {
  const config = getRuntimeConfig();
  const baseUrl = config.instagramGraphBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/${config.graphApiVersion}${resource}`, init);
  if (!response.ok) {
    throw new Error(`Instagram Graph ${response.status}: ${await response.text()}`);
  }
  return safeParseJson(response);
}
function mapPostTypeForApprovalWebhook(tipo) {
  if (tipo === "VIDEO") return "VIDEO";
  if (tipo === "REELS") return "REELS";
  return "IMAGE";
}
async function notifyPendingApprovalWebhook(post) {
  const config = getRuntimeConfig();
  if (!config.n8nApprovalWebhookUrl) {
    return;
  }
  const payload = {
    event: "post_pending_approval",
    post: {
      id: post.id,
      titulo: post.titulo,
      legenda: post.legenda,
      tipo: mapPostTypeForApprovalWebhook(post.tipo),
      status: "PENDENTE",
      media_url: post.drive_url || "",
      approval_url: `${config.appUrl}/posts/${encodeURIComponent(post.id)}`,
      created_at: post.criado_em
    }
  };
  try {
    const response = await fetch(config.n8nApprovalWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`n8n webhook ${response.status}: ${await response.text()}`);
    }
    await addLog("Database", "info", "Webhook de aprova\xE7\xE3o enviado ao n8n.", {
      postId: post.id,
      webhookUrl: config.n8nApprovalWebhookUrl
    });
  } catch (error) {
    await addLog("Database", "warn", "Falha ao enviar webhook de aprova\xE7\xE3o ao n8n.", {
      postId: post.id,
      webhookUrl: config.n8nApprovalWebhookUrl,
      error: maskError(error)
    });
  }
}
async function createInstagramContainer(post) {
  const config = getRuntimeConfig();
  const publishingActorId = getInstagramPublishingActorId();
  const body = new URLSearchParams({
    access_token: config.instagramAccessToken,
    caption: buildCaption(post)
  });
  if (post.tipo === "VIDEO" || post.tipo === "REELS") {
    if (!post.drive_url) {
      throw new Error("V\xEDdeo sem URL p\xFAblica para publica\xE7\xE3o.");
    }
    body.set("media_type", "REELS");
    body.set("video_url", post.drive_url);
  } else {
    if (!post.drive_url) {
      throw new Error("Imagem sem URL p\xFAblica para publica\xE7\xE3o.");
    }
    body.set("image_url", post.drive_url);
  }
  const result = await instagramGraphRequest(`/${publishingActorId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  return result.id;
}
async function waitForContainerReady(containerId) {
  const config = getRuntimeConfig();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await instagramGraphRequest(
      `/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(config.instagramAccessToken)}`
    );
    const code = status.status_code || status.status;
    if (!code || code === "FINISHED" || code === "PUBLISHED") {
      return;
    }
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Container do Instagram retornou status ${code}.`);
    }
    await sleep(2e3);
  }
  throw new Error("Tempo esgotado aguardando processamento da m\xEDdia no Instagram.");
}
async function publishInstagramContainer(creationId) {
  const config = getRuntimeConfig();
  const publishingActorId = getInstagramPublishingActorId();
  const publishBody = new URLSearchParams({
    creation_id: creationId,
    access_token: config.instagramAccessToken
  });
  const published = await instagramGraphRequest(`/${publishingActorId}/media_publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: publishBody
  });
  let permalink;
  try {
    const media = await instagramGraphRequest(
      `/${published.id}?fields=permalink&access_token=${encodeURIComponent(config.instagramAccessToken)}`
    );
    permalink = media.permalink;
  } catch {
    permalink = void 0;
  }
  return {
    mediaId: published.id,
    permalink
  };
}
async function publishPost(post, author) {
  await addLog("Instagram API", "info", `Iniciando publica\xE7\xE3o do post '${post.titulo}'.`, {
    postId: post.id,
    postType: post.tipo,
    publishingActorId: getInstagramPublishingActorId(),
    graphBaseUrl: getRuntimeConfig().instagramGraphBaseUrl
  });
  if (!await canUseRealMode()) {
    const simulated = await updatePostRecord(post.id, {
      status: "PUBLICADA",
      instagram_post_id: `sim_${Date.now()}`,
      data_publicacao: (/* @__PURE__ */ new Date()).toISOString(),
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
      erro_detalhe: void 0
    });
    await createHistoryRecord({
      post_id: simulated.id,
      post_titulo: simulated.titulo,
      usuario: author,
      acao: "Publicado",
      observacao: "Modo real indispon\xEDvel. Publica\xE7\xE3o mantida apenas em sandbox operacional.",
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
    });
    await addLog("Instagram API", "warn", "Publica\xE7\xE3o executada em sandbox por falta de configura\xE7\xE3o completa.", {
      missingEnv: getRuntimeConfig().missingEnv,
      missingTables: (await inspectSupabaseSchema()).missingTables
    });
    return simulated;
  }
  const creationId = await createInstagramContainer(post);
  await addLog("Instagram API", "info", "Container de m\xEDdia criado na Meta.", {
    postId: post.id,
    creationId
  });
  await updatePostRecord(post.id, {
    creation_id: creationId,
    status: "APROVADA",
    atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
  });
  await waitForContainerReady(creationId);
  const published = await publishInstagramContainer(creationId);
  const next = await updatePostRecord(post.id, {
    status: "PUBLICADA",
    instagram_post_id: published.mediaId,
    data_publicacao: (/* @__PURE__ */ new Date()).toISOString(),
    atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
    erro_detalhe: void 0
  });
  await createHistoryRecord({
    post_id: next.id,
    post_titulo: next.titulo,
    usuario: author,
    acao: "Publicado",
    observacao: published.permalink ? `Publica\xE7\xE3o conclu\xEDda com sucesso. Permalink: ${published.permalink}` : `Publica\xE7\xE3o conclu\xEDda com sucesso. Media ID: ${published.mediaId}`,
    criado_em: (/* @__PURE__ */ new Date()).toISOString()
  });
  await addLog("Instagram API", "success", `Post '${next.titulo}' publicado com sucesso.`, {
    mediaId: published.mediaId,
    permalink: published.permalink
  });
  if (next.drive_file_id) {
    try {
      await moveDriveFileToPublishedFolder(next.drive_file_id);
      await addLog("Google Drive", "info", "M\xEDdia movida para a pasta Publicados.", {
        fileId: next.drive_file_id
      });
    } catch (error) {
      await addLog("Google Drive", "warn", "Falha ao mover m\xEDdia para Publicados.", {
        fileId: next.drive_file_id,
        error: maskError(error)
      });
    }
  }
  return next;
}
async function importGoogleDrivePosts(author) {
  const folders = await ensureDriveFolders();
  const [images, videos] = await Promise.all([
    listDriveFilesFromFolder(folders.imagensId),
    listDriveFilesFromFolder(folders.videosId)
  ]);
  const files = [...images, ...videos];
  const existingPosts = await listPosts();
  const existingDriveIds = new Set(existingPosts.map((post) => post.drive_file_id).filter(Boolean));
  const createdPosts = [];
  for (const file of files) {
    if (existingDriveIds.has(file.id)) {
      continue;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
      criado_por_nome: author
    });
    await createHistoryRecord({
      post_id: created.id,
      post_titulo: created.titulo,
      usuario: author,
      acao: "Importado do Google Drive",
      observacao: `Arquivo '${file.name}' importado automaticamente da pasta monitorada.`,
      criado_em: now
    });
    await notifyPendingApprovalWebhook(created);
    createdPosts.push(created);
  }
  await addLog("Google Drive", "success", "Importa\xE7\xE3o do Google Drive conclu\xEDda.", {
    imported: createdPosts.length
  });
  return createdPosts;
}
async function runScheduledPublications() {
  const posts = await listPosts();
  const now = /* @__PURE__ */ new Date();
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
      observacao: `Hor\xE1rio de agendamento atingido em ${now.toISOString()}.`,
      criado_em: now.toISOString()
    });
    try {
      await publishPost(post, "Scheduler");
    } catch (error) {
      await updatePostRecord(post.id, {
        status: "ERRO",
        erro_detalhe: maskError(error),
        atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
      });
      await addLog("Scheduler", "error", `Falha ao publicar post agendado '${post.titulo}'.`, {
        postId: post.id,
        error: maskError(error)
      });
    }
  }
  return processed;
}
function getCurrentUserName(headerValue, fallback) {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || fallback;
  }
  return headerValue || fallback;
}
function getCurrentUserEmail(headerValue) {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || "";
  }
  return headerValue || "";
}
async function getActingUserFromRequest(req) {
  const accessToken = getAuthorizationToken(req.headers.authorization);
  if (accessToken) {
    const authUser = await fetchSupabaseAuthUser(accessToken);
    const operationalUser = await findOperationalUserByAuthIdentity(authUser);
    if (!operationalUser) {
      throw new HttpError(
        403,
        `O usu\xE1rio autenticado '${authUser.email}' n\xE3o possui cadastro operacional ativo na tabela usuarios.`
      );
    }
    if (!operationalUser.ativo) {
      throw new HttpError(403, `Usu\xE1rio '${operationalUser.email}' est\xE1 inativo.`);
    }
    return toActingUser(operationalUser);
  }
  const requestedEmail = getCurrentUserEmail(req.headers["x-user-email"]).trim().toLowerCase();
  const requestedName = getCurrentUserName(req.headers["x-user-name"], "").trim().toLowerCase();
  if (!requestedEmail && !requestedName) {
    throw new HttpError(401, "Autentica\xE7\xE3o obrigat\xF3ria.");
  }
  const users = await listUsers();
  let match = users.find((user) => requestedEmail && user.email.toLowerCase() === requestedEmail) || users.find((user) => requestedName && user.nome.toLowerCase() === requestedName);
  if (!match) {
    match = users.find((user) => user.email.toLowerCase() === "cmourasiga@gmail.com") || users.find((user) => normalizePerfilPublicacao(user) === "ADMIN") || users[0];
  }
  if (!match) {
    throw new Error("Nenhum usu\xE1rio dispon\xEDvel na base de usu\xE1rios.");
  }
  if (!match.ativo) {
    throw new Error(`Usu\xE1rio '${match.email}' est\xE1 inativo.`);
  }
  return toActingUser(match);
}
function canCreatePosts(user) {
  return user.perfil_publicacao === "CRIADOR" || user.perfil_publicacao === "ADMIN";
}
function canApprovePosts(user) {
  return user.perfil_publicacao === "APROVADOR" || user.perfil_publicacao === "ADMIN";
}
function assertCanCreatePosts(user) {
  if (!canCreatePosts(user)) {
    throw new HttpError(403, `Usu\xE1rio '${user.email}' n\xE3o possui permiss\xE3o para criar publica\xE7\xF5es.`);
  }
}
function assertCanApprovePosts(user) {
  if (!canApprovePosts(user)) {
    throw new HttpError(403, `Usu\xE1rio '${user.email}' n\xE3o possui permiss\xE3o para aprovar ou publicar.`);
  }
}
function assertIsAdmin(user) {
  if (user.perfil_publicacao !== "ADMIN") {
    throw new HttpError(403, `Usu\xE1rio '${user.email}' n\xE3o possui permiss\xE3o administrativa.`);
  }
}
function parseBody(value, fallback) {
  return value === void 0 ? fallback : value;
}
function respondWithError(res, error, service, message, status = 500) {
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
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
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
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const created = await createPostRecord({
      titulo: parseBody(req.body.titulo, "Sem T\xEDtulo"),
      legenda: parseBody(req.body.legenda, ""),
      tipo: inferPostType(req.body.tipo, req.body.filename),
      drive_file_id: req.body.drive_file_id || void 0,
      drive_url: req.body.drive_url || void 0,
      status: parseBody(req.body.status, "RASCUNHO"),
      hashtags: parseBody(req.body.hashtags, ""),
      criado_em: now,
      atualizado_em: now,
      criado_por_nome: actingUser.nome
    });
    await createHistoryRecord({
      post_id: created.id,
      post_titulo: created.titulo,
      usuario: actingUser.nome,
      acao: created.status === "PENDENTE" ? "Envio para Aprova\xE7\xE3o" : "Cria\xE7\xE3o de Post",
      observacao: created.status === "PENDENTE" ? "Post criado com m\xEDdia vinculada e enviado para aprova\xE7\xE3o." : "Post salvo como rascunho.",
      criado_em: now
    });
    await addLog("Database", "success", `Novo post '${created.titulo}' persistido.`, {
      postId: created.id,
      status: created.status
    });
    if (created.status === "PENDENTE") {
      await notifyPendingApprovalWebhook(created);
    }
    res.status(201).json({ success: true, post: created });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao criar post.");
  }
});
app.put("/api/posts/:id", async (req, res) => {
  try {
    const existing = await getPostById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
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
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
      erro_detalhe: req.body.erro_detalhe ?? existing.erro_detalhe
    });
    await createHistoryRecord({
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Edi\xE7\xE3o de Post",
      observacao: "Campos do post atualizados no painel.",
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
    });
    await addLog("Database", "info", `Post '${next.titulo}' atualizado.`, {
      postId: next.id
    });
    if (next.status === "PENDENTE") {
      await notifyPendingApprovalWebhook(next);
    }
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
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
    }
    await addLog("Database", "warn", `Post '${deleted.titulo}' removido.`, {
      postId: deleted.id,
      postTitle: deleted.titulo,
      actor: actingUser.nome,
      action: "Remo\xE7\xE3o de Post"
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
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
    }
    const next = await updatePostRecord(req.params.id, {
      status: "PENDENTE",
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
      erro_detalhe: void 0
    });
    await createHistoryRecord({
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Envio para Aprova\xE7\xE3o",
      observacao: "Post encaminhado para modera\xE7\xE3o.",
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
    });
    await notifyPendingApprovalWebhook(next);
    res.json({ success: true, post: next });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao enviar post para aprova\xE7\xE3o.");
  }
});
app.post("/api/posts/:id/reject", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const post = await getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
    }
    const next = await updatePostRecord(req.params.id, {
      status: "REJEITADA",
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
      erro_detalhe: void 0
    });
    await createHistoryRecord({
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Rejeitado",
      observacao: req.body.feedback || "Post rejeitado para ajustes editoriais.",
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
    });
    await addLog("Scheduler", "warn", `Post '${next.titulo}' rejeitado.`, {
      postId: next.id,
      feedback: req.body.feedback || ""
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
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
    }
    const action = req.body.action === "schedule" ? "schedule" : "instant";
    assertPostMediaValidation(req.body.mediaValidation, post);
    if (action === "schedule") {
      const appointmentTime = req.body.appointmentTime;
      if (!appointmentTime) {
        return res.status(400).json({ error: "appointmentTime \xE9 obrigat\xF3rio para agendamento." });
      }
      const next = await updatePostRecord(req.params.id, {
        status: "AGENDADA",
        data_agendamento: appointmentTime,
        atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
        erro_detalhe: void 0
      });
      await createHistoryRecord({
        post_id: next.id,
        post_titulo: next.titulo,
        usuario: actingUser.nome,
        acao: "Agendado",
        observacao: `Post agendado para ${appointmentTime}.`,
        criado_em: (/* @__PURE__ */ new Date()).toISOString()
      });
      await addLog("Scheduler", "info", `Post '${next.titulo}' agendado.`, {
        postId: next.id,
        appointmentTime
      });
      return res.json({ success: true, post: next });
    }
    await createHistoryRecord({
      post_id: post.id,
      post_titulo: post.titulo,
      usuario: actingUser.nome,
      acao: "Aprovado",
      observacao: "Aprova\xE7\xE3o concedida para publica\xE7\xE3o imediata.",
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
    });
    const published = await publishPost(post, actingUser.nome);
    res.json({ success: true, post: published });
  } catch (error) {
    if (req.params.id) {
      try {
        await updatePostRecord(req.params.id, {
          status: "ERRO",
          erro_detalhe: maskError(error),
          atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch {
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
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
    }
    const action = req.body.action === "schedule" ? "schedule" : "instant";
    assertPostMediaValidation(req.body.mediaValidation, post);
    if (action === "schedule") {
      const appointmentTime = req.body.appointmentTime;
      if (!appointmentTime) {
        return res.status(400).json({ error: "appointmentTime \xE9 obrigat\xF3rio para agendamento." });
      }
      const next = await updatePostRecord(post.id, {
        status: "AGENDADA",
        data_agendamento: appointmentTime,
        atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
        erro_detalhe: void 0
      });
      await createHistoryRecord({
        post_id: next.id,
        post_titulo: next.titulo,
        usuario: actingUser.nome,
        acao: "Agendado",
        observacao: `Post agendado para ${appointmentTime}.`,
        criado_em: (/* @__PURE__ */ new Date()).toISOString()
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
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
    }
    const next = await updatePostRecord(post.id, {
      status: "REJEITADA",
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
      erro_detalhe: void 0
    });
    await createHistoryRecord({
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Rejeitado",
      observacao: req.body.feedback || "Post rejeitado para ajustes editoriais.",
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
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
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
    }
    const published = await publishPost(post, actingUser.nome);
    res.json({ success: true, post: published });
  } catch (error) {
    respondWithError(res, error, "Instagram API", "Falha ao publicar post.");
  }
});
async function handleDriveUpload(req, res) {
  try {
    const actingUser = await getActingUserFromRequest(req);
    if (!canCreatePosts(actingUser) && !canApprovePosts(actingUser)) {
      throw new HttpError(403, `Usu\xE1rio '${actingUser.email}' n\xE3o possui permiss\xE3o para enviar m\xEDdias.`);
    }
    const filename = trimEnv(req.body.filename) || `upload-${Date.now()}`;
    const dataUrl = trimEnv(req.body.base64Data);
    const explicitMimeType = trimEnv(req.body.type) || "application/octet-stream";
    if (!dataUrl) {
      return res.status(400).json({ error: "base64Data \xE9 obrigat\xF3rio." });
    }
    const parsed = dataUrlToBuffer(dataUrl);
    const mimeType = parsed.mimeType || explicitMimeType;
    await addLog("Google Drive", "info", `Recebido upload de '${filename}'.`, {
      filename,
      mimeType,
      sizeBytes: req.body.sizeBytes,
      mode: (await getSettingsView()).operationalMode
    });
    if (!await canUseRealMode()) {
      return res.json({
        success: true,
        fileId: `sandbox_${(0, import_crypto.randomUUID)()}`,
        url: dataUrl,
        filename,
        folder: inferPostType(mimeType, filename) === "IMAGEM" ? "Imagens" : "Videos",
        mode: "SIMULATOR"
      });
    }
    const uploaded = await uploadFileToGoogleDrive({
      filename,
      mimeType,
      buffer: parsed.buffer
    });
    await addLog("Google Drive", "success", `Upload conclu\xEDdo para '${filename}'.`, {
      fileId: uploaded.fileId,
      folder: uploaded.folderName,
      publicUrl: uploaded.url
    });
    res.json({
      success: true,
      fileId: uploaded.fileId,
      url: uploaded.url,
      filename,
      folder: uploaded.folderName,
      mode: "REAL"
    });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha no upload ao Google Drive.");
  }
}
app.post("/api/posts/:id/media", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertCanApprovePosts(actingUser);
    const existing = await getPostById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Post n\xE3o encontrado." });
    }
    const next = await updatePostRecord(req.params.id, {
      drive_url: req.body.drive_url || existing.drive_url,
      drive_file_id: req.body.drive_file_id || existing.drive_file_id,
      tipo: inferPostType(req.body.tipo, req.body.filename || existing.titulo),
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString(),
      erro_detalhe: void 0
    });
    await createHistoryRecord({
      post_id: next.id,
      post_titulo: next.titulo,
      usuario: actingUser.nome,
      acao: "Troca de M\xEDdia",
      observacao: "M\xEDdia atualizada na etapa de modera\xE7\xE3o.",
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
    });
    await addLog("Database", "info", `M\xEDdia do post '${next.titulo}' atualizada na modera\xE7\xE3o.`, {
      postId: next.id,
      driveFileId: next.drive_file_id
    });
    return res.json({ success: true, post: next });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao atualizar a m\xEDdia do post.");
  }
});
app.post("/api/google/upload", handleDriveUpload);
app.post("/api/simulate-drive-upload", handleDriveUpload);
app.get("/api/media/:fileId", async (req, res) => {
  try {
    if (!verifyMediaSignature(req.params.fileId, String(req.query.signature || ""))) {
      return res.status(403).json({ error: "Assinatura de m\xEDdia inv\xE1lida." });
    }
    if (!await canUseRealMode()) {
      return res.status(404).json({ error: "M\xEDdia n\xE3o dispon\xEDvel fora do modo real." });
    }
    const accessToken = await getGoogleAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
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
    respondWithError(res, error, "Google Drive", "Falha ao servir m\xEDdia do Google Drive.", 502);
  }
});
app.get("/api/google/oauth/start", (req, res) => {
  const config = getRuntimeConfig();
  if (!config.googleClientId || !config.googleRedirectUri) {
    return res.status(400).json({ error: "GOOGLE_CLIENT_ID e GOOGLE_REDIRECT_URI s\xE3o obrigat\xF3rios." });
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
      return res.status(400).json({ error: "Par\xE2metro code ausente." });
    }
    if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
      return res.status(400).json({ error: "Credenciais OAuth do Google incompletas." });
    }
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: "authorization_code"
      })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const tokens = await response.json();
    const refreshToken = tokens.refresh_token || "";
    const envSnippet = [
      `GOOGLE_CLIENT_ID=${config.googleClientId}`,
      `GOOGLE_CLIENT_SECRET=${config.googleClientSecret}`,
      `GOOGLE_REFRESH_TOKEN=${refreshToken}`,
      `GOOGLE_REDIRECT_URI=${config.googleRedirectUri}`,
      `GOOGLE_DRIVE_FOLDER_ID=${config.googleDriveFolderId}`
    ].join("\n");
    const payload = {
      success: true,
      message: refreshToken ? "Callback Google conclu\xEDdo. Salve o refresh_token nas vari\xE1veis de ambiente." : "Callback Google conclu\xEDdo, mas o Google n\xE3o retornou refresh_token. Revogue o acesso do app e repita com prompt=consent.",
      refreshToken,
      envSnippet,
      tokens
    };
    const wantsJson = String(req.query.format || "").toLowerCase() === "json" || String(req.headers.accept || "").includes("application/json");
    if (wantsJson) {
      return res.json(payload);
    }
    return res.status(200).send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Google OAuth conclu\xEDdo</title>
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
      <h1 class="${refreshToken ? "ok" : "warn"}">Google OAuth conclu\xEDdo</h1>
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
        <strong>Observa\xE7\xE3o</strong>
        <p>Se o refresh token vier vazio, revogue o acesso do app Google autorizado anteriormente e repita o fluxo para for\xE7ar uma nova concess\xE3o offline.</p>
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
      posts: imported
    });
  } catch (error) {
    respondWithError(res, error, "Google Drive", "Falha ao importar arquivos do Google Drive.");
  }
});
app.get("/api/meta/oauth/start", (_req, res) => {
  const config = getRuntimeConfig();
  if (!config.metaAppId || !config.metaRedirectUri) {
    return res.status(400).json({ error: "META_APP_ID e META_REDIRECT_URI s\xE3o obrigat\xF3rios." });
  }
  const url = new URL(`https://www.facebook.com/${config.graphApiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", config.metaAppId);
  url.searchParams.set("redirect_uri", config.metaRedirectUri);
  url.searchParams.set(
    "scope",
    "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management"
  );
  res.redirect(url.toString());
});
app.get("/api/meta/oauth/callback", async (req, res) => {
  try {
    const config = getRuntimeConfig();
    const code = trimEnv(String(req.query.code || ""));
    if (!code) {
      return res.status(400).json({ error: "Par\xE2metro code ausente." });
    }
    if (!config.metaAppId || !config.metaAppSecret || !config.metaRedirectUri) {
      return res.status(400).json({ error: "Credenciais OAuth da Meta incompletas." });
    }
    const shortLived = await metaGraphRequest(`/oauth/access_token?${new URLSearchParams({
      client_id: config.metaAppId,
      client_secret: config.metaAppSecret,
      redirect_uri: config.metaRedirectUri,
      code
    }).toString()}`);
    const longLived = await metaGraphRequest(`/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: config.metaAppId,
      client_secret: config.metaAppSecret,
      fb_exchange_token: shortLived.access_token
    }).toString()}`);
    const pages = await metaGraphRequest(`/me/accounts?access_token=${encodeURIComponent(longLived.access_token)}`);
    const pageId = pages.data?.[0]?.id || "";
    let instagramBusinessId = "";
    if (pageId) {
      const igAccount = await metaGraphRequest(
        `/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(longLived.access_token)}`
      );
      instagramBusinessId = igAccount.instagram_business_account?.id || "";
    }
    res.json({
      success: true,
      message: "Callback Meta conclu\xEDdo. Salve os valores abaixo no ambiente da aplica\xE7\xE3o.",
      accessToken: longLived.access_token,
      facebookPageId: pageId,
      instagramBusinessId
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
    respondWithError(res, error, "Scheduler", "Falha ao processar publica\xE7\xF5es agendadas.");
  }
});
app.get("/api/history", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    res.json({ history: await listHistory() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar hist\xF3rico.");
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
    respondWithError(res, error, "Database", "Falha ao carregar configura\xE7\xE3o p\xFAblica.", 500);
  }
});
app.get("/api/auth/me", async (req, res) => {
  try {
    res.json({ user: await getActingUserFromRequest(req) });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao validar usu\xE1rio autenticado.", 401);
  }
});
app.get("/api/settings", async (req, res) => {
  try {
    await getActingUserFromRequest(req);
    res.json({ settings: await getSettingsView() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao ler estado das integra\xE7\xF5es.");
  }
});
app.post("/api/settings", (_req, res) => {
  res.status(405).json({
    success: false,
    error: "As integra\xE7\xF5es agora s\xE3o configuradas exclusivamente por vari\xE1veis de ambiente no backend."
  });
});
app.get("/api/users", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    res.json({ users: await listUsers() });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao listar usu\xE1rios.");
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
    const ativo = req.body.ativo === void 0 ? true : Boolean(req.body.ativo);
    if (!nome) {
      return res.status(400).json({ error: "Nome \xE9 obrigat\xF3rio." });
    }
    if (!email) {
      return res.status(400).json({ error: "E-mail \xE9 obrigat\xF3rio." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Senha provis\xF3ria deve ter ao menos 6 caracteres." });
    }
    const existingUsers = await listUsers();
    if (existingUsers.some((user) => user.email.toLowerCase() === email)) {
      return res.status(409).json({ error: "J\xE1 existe usu\xE1rio operacional cadastrado com este e-mail." });
    }
    const roleColumnAvailable = await hasUsuariosRoleColumn();
    if (!roleColumnAvailable && perfilPublicacao === "APROVADOR") {
      return res.status(400).json({
        error: "A tabela usuarios ainda n\xE3o possui a coluna perfil_publicacao. Neste ambiente s\xF3 \xE9 poss\xEDvel usar Administrador ou Criador."
      });
    }
    const authUserId = await createSupabaseAuthUser({ email, password, nome });
    const created = await createOperationalUserRecord({
      nome,
      email,
      ativo,
      perfil_publicacao: perfilPublicacao,
      auth_user_id: authUserId
    });
    await addLog("Database", "success", `Usu\xE1rio '${created.email}' criado pelo painel.`, {
      userId: created.id,
      authUserId,
      perfil_publicacao: created.perfil_publicacao,
      ativo: created.ativo
    });
    res.status(201).json({ success: true, user: created });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao criar usu\xE1rio.");
  }
});
app.put("/api/users/:id", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    const users = await listUsers();
    const existingUser = users.find((user) => user.id === req.params.id);
    if (!existingUser) {
      throw new HttpError(404, "Usu\xE1rio n\xE3o encontrado.");
    }
    const roleColumnAvailable = await hasUsuariosRoleColumn();
    const perfilPublicacao = req.body.perfil_publicacao ? inferPerfilPublicacaoFromRawValue(req.body.perfil_publicacao) : void 0;
    if (!roleColumnAvailable && perfilPublicacao === "APROVADOR") {
      throw new HttpError(
        400,
        "A tabela usuarios ainda n\xE3o possui a coluna perfil_publicacao. Neste ambiente s\xF3 \xE9 poss\xEDvel usar Administrador ou Criador."
      );
    }
    const nextEmail = trimEnv(req.body.email || existingUser.email).toLowerCase();
    if (!nextEmail) {
      throw new HttpError(400, "E-mail \xE9 obrigat\xF3rio.");
    }
    const duplicatedEmail = users.find((user) => user.id !== req.params.id && user.email.toLowerCase() === nextEmail);
    if (duplicatedEmail) {
      throw new HttpError(409, "J\xE1 existe outro usu\xE1rio com este e-mail.");
    }
    if (existingUser.auth_user_id && (nextEmail !== existingUser.email.toLowerCase() || req.body.nome !== void 0)) {
      await updateSupabaseAuthUser(existingUser.auth_user_id, {
        email: nextEmail,
        nome: String(req.body.nome ?? existingUser.nome)
      });
    }
    const updated = await updateUserRecord(req.params.id, {
      nome: req.body.nome,
      email: nextEmail,
      ativo: req.body.ativo,
      perfil_publicacao: perfilPublicacao,
      perfil: perfilPublicacao ? perfilPublicacao === "ADMIN" ? "ADMIN" : "OPERADOR" : req.body.perfil
    });
    await createHistoryRecord({
      post_id: updated.id,
      post_titulo: "Usu\xE1rio operacional",
      usuario: actingUser.nome,
      acao: "Edi\xE7\xE3o de Usu\xE1rio",
      observacao: `Cadastro operacional de ${updated.nome} atualizado no painel.`,
      criado_em: (/* @__PURE__ */ new Date()).toISOString()
    });
    await addLog("Database", "info", `Usu\xE1rio '${updated.email}' atualizado.`, {
      userId: updated.id,
      perfil_publicacao: updated.perfil_publicacao,
      ativo: updated.ativo
    });
    res.json({ success: true, user: updated });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao atualizar usu\xE1rio.");
  }
});
app.delete("/api/users/:id", async (req, res) => {
  try {
    const actingUser = await getActingUserFromRequest(req);
    assertIsAdmin(actingUser);
    const users = await listUsers();
    const target = users.find((user) => user.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    }
    if (target.email.toLowerCase() === actingUser.email.toLowerCase()) {
      return res.status(400).json({ error: "N\xE3o \xE9 permitido excluir o pr\xF3prio usu\xE1rio administrador em uso." });
    }
    if (target.auth_user_id) {
      await deleteSupabaseAuthUser(target.auth_user_id);
    }
    const deleted = await deleteOperationalUserRecord(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    }
    await addLog("Database", "warn", `Usu\xE1rio '${deleted.email}' exclu\xEDdo do painel.`, {
      userId: deleted.id,
      authUserId: deleted.auth_user_id
    });
    res.json({ success: true, user: deleted });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao excluir usu\xE1rio.");
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
      return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    }
    if (!target.auth_user_id) {
      return res.status(400).json({ error: "Este usu\xE1rio n\xE3o possui v\xEDnculo com Supabase Auth para redefini\xE7\xE3o de senha." });
    }
    await updateSupabaseAuthUser(target.auth_user_id, {
      email: target.email,
      nome: target.nome,
      password: newPassword
    });
    await addLog("Database", "info", `Senha do usu\xE1rio '${target.email}' redefinida pelo painel.`, {
      userId: target.id,
      authUserId: target.auth_user_id
    });
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error, "Database", "Falha ao redefinir senha do usu\xE1rio.");
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
      model: getRuntimeConfig().geminiModel
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
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse((response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
    await addLog("Gemini AI", "success", "Legenda gerada com sucesso.");
    res.json({
      success: true,
      legenda: parsed.legenda || "",
      hashtags: parsed.hashtags || ""
    });
  } catch (error) {
    await addLog("Gemini AI", "warn", "Falha na Gemini API. Aplicando fallback local.", {
      error: maskError(error)
    });
    const fallbackHashtags = ["#instagram", "#marketingdigital", "#conteudo", "#socialmedia", "#branding"].slice(0, count).join(" ");
    res.json({
      success: true,
      legenda: `${title}

${prompt || "Conte\xFAdo preparado para revis\xE3o e publica\xE7\xE3o no Instagram."}`,
      hashtags: fallbackHashtags,
      isFallback: true
    });
  }
});
var initializationPromise = null;
async function initializeApp(options) {
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
      await addLog("Database", "warn", "Falha ao validar base de usu\xE1rios durante o bootstrap.", {
        error: maskError(error)
      });
    }
    if (enableStatic) {
      if (process.env.NODE_ENV !== "production") {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa"
        });
        app.use(vite.middlewares);
      } else {
        const distPath = import_path.default.join(process.cwd(), "dist");
        app.use(import_express.default.static(distPath));
        app.get("*", (_req, res) => {
          res.sendFile(import_path.default.join(distPath, "index.html"));
        });
      }
    }
  })();
  return initializationPromise;
}
var server_default = app;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  initializeApp
});
//# sourceMappingURL=server.cjs.map
