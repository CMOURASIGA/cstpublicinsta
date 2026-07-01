import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

async function rest(pathname, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status} em ${pathname}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

const now = new Date().toISOString();
const systemRows = [
  {
    chave: "APP_URL",
    valor: (process.env.APP_URL || "").trim(),
    tipo: "STRING",
    categoria: "GERAL",
    descricao: "URL publica da aplicacao.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "SUPABASE_URL",
    valor: supabaseUrl,
    tipo: "STRING",
    categoria: "BANCO",
    descricao: "URL do projeto Supabase.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "SUPABASE_ANON_KEY",
    valor_encrypted: (process.env.SUPABASE_ANON_KEY || "").trim(),
    tipo: "SECRET",
    categoria: "BANCO",
    descricao: "Chave publica do Supabase.",
    sensivel: true,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "DEFAULT_CLIENT_SLUG",
    valor: (process.env.DEFAULT_CLIENT_SLUG || "cliente-inicial").trim(),
    tipo: "STRING",
    categoria: "CLIENTES",
    descricao: "Slug padrao da plataforma.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "INSTAGRAM_GRAPH_BASE_URL",
    valor: (process.env.INSTAGRAM_GRAPH_BASE_URL || "https://graph.facebook.com").trim(),
    tipo: "STRING",
    categoria: "META",
    descricao: "Base global da Graph API.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "GRAPH_API_VERSION",
    valor: (process.env.GRAPH_API_VERSION || "v23.0").trim(),
    tipo: "STRING",
    categoria: "META",
    descricao: "Versao global da Graph API.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "GOOGLE_CLIENT_ID",
    valor: (process.env.GOOGLE_CLIENT_ID || "").trim(),
    tipo: "STRING",
    categoria: "GOOGLE",
    descricao: "Client ID global do Google OAuth.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "GOOGLE_REDIRECT_URI",
    valor: (process.env.GOOGLE_REDIRECT_URI || "").trim(),
    tipo: "STRING",
    categoria: "GOOGLE",
    descricao: "Redirect URI global do Google OAuth.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "GOOGLE_CLIENT_EMAIL",
    valor: (process.env.GOOGLE_CLIENT_EMAIL || "").trim(),
    tipo: "STRING",
    categoria: "GOOGLE",
    descricao: "Conta de servico global do Google Drive.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "META_APP_ID",
    valor: (process.env.META_APP_ID || "").trim(),
    tipo: "STRING",
    categoria: "META",
    descricao: "App ID global da Meta.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "META_REDIRECT_URI",
    valor: (process.env.META_REDIRECT_URI || "").trim(),
    tipo: "STRING",
    categoria: "META",
    descricao: "Redirect URI global da Meta.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "META_VERIFY_TOKEN",
    valor_encrypted: (process.env.META_VERIFY_TOKEN || "").trim(),
    tipo: "SECRET",
    categoria: "META",
    descricao: "Token global de verificacao da Meta.",
    sensivel: true,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "AI_DEFAULT_PROVIDER",
    valor: (process.env.AI_DEFAULT_PROVIDER || "GEMINI").trim(),
    tipo: "STRING",
    categoria: "IA",
    descricao: "Provedor padrao do sistema.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "AI_DEFAULT_MODEL",
    valor: (process.env.AI_DEFAULT_MODEL || "gemini-2.5-flash").trim(),
    tipo: "STRING",
    categoria: "IA",
    descricao: "Modelo padrao do sistema.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "AI_PROVIDER_OPTIONS",
    valor: (process.env.AI_PROVIDER_OPTIONS || "").trim(),
    tipo: "STRING",
    categoria: "IA",
    descricao: "Catalogo de provedores habilitados.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
  {
    chave: "CLIENT_INTEGRATIONS_STORAGE",
    valor: (process.env.CLIENT_INTEGRATIONS_STORAGE || "SUPABASE").trim(),
    tipo: "STRING",
    categoria: "SEGURANCA",
    descricao: "Origem das credenciais especificas do cliente.",
    sensivel: false,
    editavel: false,
    atualizado_em: now,
  },
].map((item) => ({
  chave: item.chave,
  valor: item.valor ?? null,
  valor_encrypted: item.valor_encrypted ?? null,
  tipo: item.tipo,
  categoria: item.categoria,
  descricao: item.descricao ?? null,
  sensivel: Boolean(item.sensivel),
  editavel: Boolean(item.editavel),
  atualizado_em: item.atualizado_em ?? now,
}));

function getClientDefaults() {
  return [
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
      valor: (process.env.AI_DEFAULT_PROVIDER || "GEMINI").trim(),
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
      valor: (process.env.AI_DEFAULT_MODEL || "gemini-2.5-flash").trim(),
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
  ].map((item) => ({
    chave: item.chave,
    valor: item.valor ?? null,
    valor_encrypted: item.valor_encrypted ?? null,
    tipo: item.tipo,
    categoria: item.categoria,
    descricao: item.descricao ?? null,
    sensivel: Boolean(item.sensivel),
    editavel_por_cliente: Boolean(item.editavel_por_cliente),
    usar_padrao_sistema: Boolean(item.usar_padrao_sistema),
  }));
}

const clientes = await rest("clientes?select=id,slug,nome&order=nome.asc");

await rest("sistema_configuracoes?on_conflict=chave", {
  method: "POST",
  headers: {
    Prefer: "return=representation,resolution=merge-duplicates",
  },
  body: JSON.stringify(systemRows),
});

for (const cliente of clientes) {
  await rest("cliente_integracoes?on_conflict=cliente_id", {
    method: "POST",
    headers: {
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify([
      {
        cliente_id: cliente.id,
        graph_api_version: (process.env.GRAPH_API_VERSION || "v23.0").trim(),
        modo_operacao: "SIMULADOR",
        atualizado_em: now,
      },
    ]),
  });

  const configRows = getClientDefaults().map((item) => ({
    cliente_id: cliente.id,
    ...item,
    atualizado_em: now,
  }));

  await rest("cliente_configuracoes?on_conflict=cliente_id,chave", {
    method: "POST",
    headers: {
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify(configRows),
  });
}

console.log(`Sincronizacao concluida para ${clientes.length} cliente(s).`);
