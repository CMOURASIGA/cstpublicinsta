import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Post, Usuario, HistoricoPost, SettingsConfig, LogMessage } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db_storage.json");

app.use(express.json({ limit: "50mb" }));

// Lazy initializer for Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// -----------------------------------------------------------------------------
// Database Persistence (Simple local JSON store)
// -----------------------------------------------------------------------------
interface LocalDB {
  posts: Post[];
  usuarios: Usuario[];
  historicos: HistoricoPost[];
  settings: SettingsConfig;
  logs: LogMessage[];
}

function getInitialDB(): LocalDB {
  const nowStr = new Date().toISOString();
  
  const defaultUsers: Usuario[] = [
    {
      id: "u1",
      nome: "Carlos Moura",
      email: "cmourasiga@gmail.com",
      perfil: "ADMINISTRADOR",
      ativo: true,
      criado_em: nowStr
    },
    {
      id: "u2",
      nome: "Juliana Santos (Marketing Team)",
      email: "juliana@agencyflow.com",
      perfil: "USUARIO",
      ativo: true,
      criado_em: nowStr
    }
  ];

  const defaultPosts: Post[] = [
    {
      id: "p1",
      titulo: "Lançamento Coleção Outono/Inverno",
      legenda: "Nossa nova coleção de casacos e suéteres sustentáveis chegou! Peças criadas inteiramente a partir de fios de algodão orgânico reciclado e fibras biodegradáveis. Conecte-se com o estilo de forma consciente.",
      tipo: "IMAGEM",
      drive_file_id: "drive_img_001",
      drive_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80",
      status: "PUBLICADA",
      instagram_post_id: "ig_post_890712395",
      data_publicacao: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      criado_em: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      atualizado_em: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      hashtags: "#modaoutono #sustentabilidade #estiloconsistente #lifestyle",
      criado_por_nome: "Juliana Santos (Marketing Team)"
    },
    {
      id: "p2",
      titulo: "Dica Semanal: Produtividade Remota",
      legenda: "Dividir o seu dia profissional em blocos focados de 90 minutos melhora sua cognição e reduz as dores nas costas! Experimente a técnica e reserve uma pausa ativa de 10 minutos para se esticar entre os sprints de foco.",
      tipo: "VIDEO",
      drive_file_id: "drive_vid_002",
      drive_url: "https://assets.mixkit.co/videos/preview/mixkit-woman-working-at-home-office-40428-large.mp4",
      status: "PENDENTE",
      criado_em: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      atualizado_em: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      hashtags: "#produtividade #homeoffice #trabalhoremoto #focoforça",
      criado_por_nome: "Juliana Santos (Marketing Team)"
    },
    {
      id: "p3",
      titulo: "Sorteio de Fim de Ano - Regras Oficiais",
      legenda: "Queremos retribuir toda a parceria desse ano! Siga nossa página, marque 3 amigos de marketing nos comentários e concorra a um curso completo de Automações Digitais com Certificação Premium.",
      tipo: "IMAGEM",
      status: "RASCUNHO",
      criado_em: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      atualizado_em: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      hashtags: "#sorteiodigital #marketingtips #automacao #audiencia",
      criado_por_nome: "Juliana Santos (Marketing Team)"
    },
    {
      id: "p4",
      titulo: "Tendências de UI/UX para 2027",
      legenda: "As interfaces móveis estão se concentrando cada vez mais na micro-interatividade e em feedbacks hápticos ultra-detalhados. O que você acha dos layouts híbridos de gradiente fluído?",
      tipo: "IMAGEM",
      drive_file_id: "drive_img_003",
      drive_url: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=800&q=80",
      status: "AGENDADA",
      data_agendamento: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      criado_em: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      atualizado_em: new Date(Date.now() - 5 * 1000).toISOString(),
      hashtags: "#uidesign #uxdesign #microinteractions #interfacedesign",
      criado_por_nome: "Juliana Santos (Marketing Team)"
    },
    {
      id: "p5",
      titulo: "Dica: Melhores Práticas Clean Code",
      legenda: "Evite funções infladas! Uma função de qualidade ideal resolve exatamente uma única e isolada responsabilidade por completo.",
      tipo: "IMAGEM",
      drive_file_id: "drive_img_004",
      drive_url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
      status: "REJEITADA",
      criado_em: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      atualizado_em: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
      hashtags: "#cleancode #refactoring #typescript #fullstack",
      criado_por_nome: "Juliana Santos (Marketing Team)"
    }
  ];

  const defaultHistoricos: HistoricoPost[] = [
    {
      id: "h1",
      post_id: "p1",
      post_titulo: "Lançamento Coleção Outono/Inverno",
      usuario: "Juliana Santos (Marketing Team)",
      acao: "Criação de Post",
      observacao: "Post criado com legenda provisória e imagem do drive anexada.",
      criado_em: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "h2",
      post_id: "p1",
      post_titulo: "Lançamento Coleção Outono/Inverno",
      usuario: "Juliana Santos (Marketing Team)",
      acao: "Envio para Aprovação",
      observacao: "Legenda final estruturada e revisada pela equipe criativa.",
      criado_em: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "h3",
      post_id: "p1",
      post_titulo: "Lançamento Coleção Outono/Inverno",
      usuario: "Carlos Moura",
      acao: "Aprovado",
      observacao: "Legenda aprovada sem ressalvas. Publicado imediatamente.",
      criado_em: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "h4",
      post_id: "p1",
      post_titulo: "Lançamento Coleção Outono/Inverno",
      usuario: "Sistema",
      acao: "Publicado",
      observacao: "Publicação concluída via Instagram Graph API. ID do Post: ig_post_890712395",
      criado_em: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "h5",
      post_id: "p2",
      post_titulo: "Dica Semanal: Produtividade Remota",
      usuario: "Juliana Santos (Marketing Team)",
      acao: "Criação de Post",
      observacao: "Anexado vídeo explicativo do drive.",
      criado_em: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "h6",
      post_id: "p2",
      post_titulo: "Dica Semanal: Produtividade Remota",
      usuario: "Juliana Santos (Marketing Team)",
      acao: "Envio para Aprovação",
      observacao: "Aguardando homologação de Carlos.",
      criado_em: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "h7",
      post_id: "p5",
      post_titulo: "Dica: Melhores Práticas Clean Code",
      usuario: "Carlos Moura",
      acao: "Rejeitado",
      observacao: "Rejeitado por Legenda fraca. Carlos solicitou: 'Legenda muito curta e sem hashtags estratégicas. Por favor, utilize a IA do Gemini nas configurações para criar algo mais impactante'.",
      criado_em: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString()
    }
  ];

  const defaultSettings: SettingsConfig = {
    mode: "SIMULATOR",
    supabaseUrl: "",
    supabaseKey: "",
    googleDriveFolderId: "1-IG_Approval_Workspace_Root",
    instagramAccessToken: "EAAM77vT79FMBAM_IG_SIMULATED_LONG_LIVED_TOKEN_3A901",
    instagramBusinessId: "17841405342901324",
    geminiModel: "gemini-3.5-flash"
  };

  const defaultLogs: LogMessage[] = [
    {
      id: "l1",
      timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      service: "Database",
      type: "info",
      message: "Conexão simulada com Banco de Dados Supabase estabelecida em modo Sandbox."
    },
    {
      id: "l2",
      timestamp: new Date(Date.now() - 49 * 60 * 1000).toISOString(),
      service: "Google Drive",
      type: "success",
      message: "Pastas de estrutura do Drive detectadas: /Imagens (OK), /Videos (OK), /Publicados (OK)."
    },
    {
      id: "l3",
      timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      service: "Instagram API",
      type: "success",
      message: "Token de acesso do Instagram verificado. Escopos ativos: instagram_basic, instagram_content_publish."
    },
    {
      id: "l4",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      service: "Instagram API",
      type: "info",
      message: "Iniciando publicação automática de 'Lançamento Coleção Outono/Inverno'...",
      payload: "{ object: 'container', type: 'IMAGE', url: 'https://images.unsplash.com...' }"
    },
    {
      id: "l5",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      service: "Instagram API",
      type: "success",
      message: "Container de Mídia criado com ID '9871239851'. Aguardando processamento da infraestrutura Meta."
    },
    {
      id: "l6",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      service: "Instagram API",
      type: "success",
      message: "Mídia publicada com sucesso! ID no feed: ig_post_890712395."
    }
  ];

  return {
    posts: defaultPosts,
    usuarios: defaultUsers,
    historicos: defaultHistoricos,
    settings: defaultSettings,
    logs: defaultLogs
  };
}

function loadDB(): LocalDB {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Erro ao carregar banco de dados local. Iniciando novo.", error);
  }
  const initial = getInitialDB();
  saveDB(initial);
  return initial;
}

function saveDB(db: LocalDB) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Erro ao salvar banco de dados local.", error);
  }
}

// -----------------------------------------------------------------------------
// Logging Helper Helper
// -----------------------------------------------------------------------------
function addLog(
  service: LogMessage["service"],
  type: LogMessage["type"],
  message: string,
  payload?: any
) {
  const db = loadDB();
  const newLog: LogMessage = {
    id: "log_" + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    service,
    type,
    message,
    payload: payload ? JSON.stringify(payload, null, 2) : undefined
  };
  db.logs.unshift(newLog);
  // Keep last 100 logs
  if (db.logs.length > 100) {
    db.logs = db.logs.slice(0, 100);
  }
  saveDB(db);
}

// -----------------------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------------------

// Read all posts
app.get("/api/posts", (req, res) => {
  const db = loadDB();
  res.json({ posts: db.posts });
});

// Create a new post
app.post("/api/posts", (req, res) => {
  const db = loadDB();
  const { titulo, legenda, tipo, drive_url, drive_file_id, hashtags, status } = req.body;
  const username = req.headers["x-user-name"] as string || "Juliana Santos (Marketing Team)";

  const newPost: Post = {
    id: "post_" + Math.random().toString(36).substr(2, 9),
    titulo: titulo || "Sem Título",
    legenda: legenda || "",
    tipo: tipo === "VIDEO" ? "VIDEO" : "IMAGEM",
    drive_file_id: drive_file_id || null,
    drive_url: drive_url || null,
    status: (status as Post["status"]) || "RASCUNHO",
    hashtags: hashtags || "",
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    criado_por_nome: username
  };

  db.posts.unshift(newPost);

  // Auto add log for user action
  const actionText = newPost.status === "PENDENTE" ? "Envio para Aprovação" : "Criação de Post";
  const obsText = newPost.status === "PENDENTE" 
    ? "Post criado e enviado diretamente para aprovação do Administrador."
    : "Post criado e salvo nas rascunhos.";

  const newAudit: HistoricoPost = {
    id: "h_" + Math.random().toString(36).substr(2, 9),
    post_id: newPost.id,
    post_titulo: newPost.titulo,
    usuario: username,
    acao: actionText,
    observacao: obsText,
    criado_em: new Date().toISOString()
  };

  db.historicos.unshift(newAudit);
  saveDB(db);

  addLog(
    "Database",
    "success",
    `Novo post '${newPost.titulo}' salvo como ${newPost.status}.`,
    newPost
  );

  res.status(201).json({ success: true, post: newPost });
});

// Update an existing post
app.put("/api/posts/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  const { titulo, legenda, hashtags, data_agendamento, drive_url, drive_file_id, status } = req.body;
  const username = req.headers["x-user-name"] as string || "Carlos Moura";

  const postIndex = db.posts.findIndex(p => p.id === id);
  if (postIndex === -1) {
    return res.status(404).json({ error: "Post não encontrado" });
  }

  const post = db.posts[postIndex];
  const oldStatus = post.status;
  
  // Updates
  if (titulo !== undefined) post.titulo = titulo;
  if (legenda !== undefined) post.legenda = legenda;
  if (hashtags !== undefined) post.hashtags = hashtags;
  if (data_agendamento !== undefined) post.data_agendamento = data_agendamento;
  if (drive_url !== undefined) post.drive_url = drive_url;
  if (drive_file_id !== undefined) post.drive_file_id = drive_file_id;
  if (status !== undefined) post.status = status;
  post.atualizado_em = new Date().toISOString();

  // Audit triggers
  let action = "Edição de Post";
  let obs = "Dados da postagem editados.";
  if (status && status !== oldStatus) {
    action = `Mudança de Status`;
    obs = `Status modificado de ${oldStatus} para ${status}.`;
  }

  const audit: HistoricoPost = {
    id: "h_" + Math.random().toString(36).substr(2, 9),
    post_id: post.id,
    post_titulo: post.titulo,
    usuario: username,
    acao: action,
    observacao: obs,
    criado_em: new Date().toISOString()
  };

  db.historicos.unshift(audit);
  saveDB(db);

  addLog(
    "Database",
    "info",
    `Post '${post.titulo}' atualizado pelo usuário ${username}.`,
    { updated_fields: { titulo, legenda, status, data_agendamento } }
  );

  res.json({ success: true, post });
});

// Delete a post
app.delete("/api/posts/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  const postIndex = db.posts.findIndex(p => p.id === id);
  if (postIndex === -1) {
    return res.status(404).json({ error: "Post não encontrado" });
  }

  const post = db.posts[postIndex];
  db.posts.splice(postIndex, 1);

  // Keep audits but remove dangling relations? Or keep audits for history tracking.
  const audit: HistoricoPost = {
    id: "h_" + Math.random().toString(36).substr(2, 9),
    post_id: id,
    post_titulo: post.titulo,
    usuario: req.headers["x-user-name"] as string || "Carlos Moura",
    acao: "Remoção de Post",
    observacao: "A postagem foi excluída permanentemente do gestor.",
    criado_em: new Date().toISOString()
  };

  db.historicos.unshift(audit);
  saveDB(db);

  addLog("Database", "warn", `Post de ID '${id}' ('${post.titulo}') removido.`);
  res.json({ success: true });
});

// Submit post for approval
app.post("/api/posts/:id/submit", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  const postIndex = db.posts.findIndex(p => p.id === id);
  if (postIndex === -1) {
    return res.status(404).json({ error: "Post não encontrado" });
  }

  const post = db.posts[postIndex];
  const oldStatus = post.status;
  post.status = "PENDENTE";
  post.atualizado_em = new Date().toISOString();

  const audit: HistoricoPost = {
    id: "h_" + Math.random().toString(36).substr(2, 9),
    post_id: post.id,
    post_titulo: post.titulo,
    usuario: req.headers["x-user-name"] as string || "Juliana Santos (Marketing Team)",
    acao: "Envio para Aprovação",
    observacao: `Status alterado de ${oldStatus} para PENDENTE. Pronto para revisão de Carlos Moura.`,
    criado_em: new Date().toISOString()
  };

  db.historicos.unshift(audit);
  saveDB(db);

  addLog(
    "Database",
    "info",
    `Post '${post.titulo}' enviado para aprovação da gerência. Status: PENDENTE`
  );

  res.json({ success: true, post });
});

// Reject post
app.post("/api/posts/:id/reject", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  const { feedback } = req.body;
  const username = req.headers["x-user-name"] as string || "Carlos Moura";

  const postIndex = db.posts.findIndex(p => p.id === id);
  if (postIndex === -1) {
    return res.status(404).json({ error: "Post não encontrado" });
  }

  const post = db.posts[postIndex];
  post.status = "REJEITADA";
  post.atualizado_em = new Date().toISOString();

  const audit: HistoricoPost = {
    id: "h_" + Math.random().toString(36).substr(2, 9),
    post_id: post.id,
    post_titulo: post.titulo,
    usuario: username,
    acao: "Rejeitado",
    observacao: `A postagem foi recusada. Feedback do administrador: "${feedback || "Necessita de pequenos ajustes em hashtag/conteúdo"}"`,
    criado_em: new Date().toISOString()
  };

  db.historicos.unshift(audit);
  saveDB(db);

  addLog(
    "Scheduler",
    "warn",
    `Post '${post.titulo}' foi REJEITADO por ${username}. Motivo: ${feedback || "S/M"}`
  );

  res.json({ success: true, post });
});

// Simulate Google Drive Upload Endpoint
app.post("/api/simulate-drive-upload", (req, res) => {
  const { filename, type, sizeBytes, base64Data } = req.body;
  const isVideo = type?.includes("video") || filename?.endsWith(".mp4");
  const subFolder = isVideo ? "/Videos" : "/Imagens";
  const fileId = "drv_" + Math.random().toString(36).substr(2, 12);
  
  // Set accurate simulation assets or use the submitted small visual files
  const simulatedUrl = isVideo 
    ? "https://assets.mixkit.co/videos/preview/mixkit-woman-working-at-home-office-40428-large.mp4" 
    : (base64Data || "https://images.unsplash.com/photo-1542744094-3a31f103e35f?auto=format&fit=crop&w=800&q=80");

  addLog(
    "Google Drive",
    "info",
    `Iniciando upload para Google Drive... Destino: Instagram ${subFolder}/${filename} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`
  );

  setTimeout(() => {
    addLog(
      "Google Drive",
      "success",
      `Arquivo '${filename}' carregado com sucesso no Google Drive. ID do arquivo: ${fileId}.`,
      { drive_path: `Instagram${subFolder}/${filename}`, file_id: fileId, public_link: simulatedUrl }
    );
  }, 1000);

  res.json({
    success: true,
    fileId,
    url: simulatedUrl,
    filename,
    folder: subFolder
  });
});

// Publish or Schedule API
app.post("/api/posts/:id/approve", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  const { action, appointmentTime } = req.body; // action: 'instant' | 'schedule', appointmentTime: ISO String
  const username = req.headers["x-user-name"] as string || "Carlos Moura";

  const postIndex = db.posts.findIndex(p => p.id === id);
  if (postIndex === -1) {
    return res.status(404).json({ error: "Post não encontrado" });
  }

  const post = db.posts[postIndex];

  if (action === "schedule") {
    post.status = "AGENDADA";
    post.data_agendamento = appointmentTime;
    post.atualizado_em = new Date().toISOString();

    const audit: HistoricoPost = {
      id: "h_" + Math.random().toString(36).substr(2, 9),
      post_id: post.id,
      post_titulo: post.titulo,
      usuario: username,
      acao: "Agendado",
      observacao: `Aprovação concedida por ${username}. Publicação agendada para: ${new Date(appointmentTime).toLocaleString("pt-BR")}.`,
      criado_em: new Date().toISOString()
    };

    db.historicos.unshift(audit);
    saveDB(db);

    addLog(
      "Scheduler",
      "info",
      `Post '${post.titulo}' agendado para publicação automática em ${new Date(appointmentTime).toLocaleTimeString()}.`
    );

    res.json({ success: true, post });
  } else {
    // Publish instantly!
    post.status = "APROVADA";
    post.atualizado_em = new Date().toISOString();

    const auditApprove: HistoricoPost = {
      id: "h_" + Math.random().toString(36).substr(2, 9),
      post_id: post.id,
      post_titulo: post.titulo,
      usuario: username,
      acao: "Aprovado",
      observacao: `Aprovado para postagem imediata pelo Administrador ${username}.`,
      criado_em: new Date().toISOString()
    };
    db.historicos.unshift(auditApprove);
    saveDB(db);

    // Trigger instant simulation publishing
    publishToInstagramAPI(post, db, username);

    res.json({ success: true, post });
  }
});

// Instagram Simulation Publisher core function
function publishToInstagramAPI(post: Post, db: LocalDB, author: string) {
  const postTitle = post.titulo;
  const postId = post.id;

  addLog(
    "Instagram API",
    "info",
    `Iniciando fluxo de publicação da mídia a partir do Google Drive para o Instagram Business ID '${db.settings.instagramBusinessId}'...`
  );

  // Step 1: Create media container
  setTimeout(() => {
    const containerId = "container_" + Math.random().toString(36).substr(2, 11);
    addLog(
      "Instagram API",
      "success",
      `Container de Mídia com ID '${containerId}' criado. Carregando recursos do Drive: ${post.drive_url ? post.drive_url.substring(0, 50) + "..." : "Simulated Local Resource"}.`
    );

    // Step 2: Media status pool and publish
    setTimeout(() => {
      const igPostId = "ig_post_" + Math.floor(100000000 + Math.random() * 900000000);
      
      // Update Post structure in DB
      const dbFresh = loadDB();
      const currentPost = dbFresh.posts.find(p => p.id === postId);
      if (currentPost) {
        currentPost.status = "PUBLICADA";
        currentPost.instagram_post_id = igPostId;
        currentPost.data_publicacao = new Date().toISOString();
        currentPost.atualizado_em = new Date().toISOString();
      }

      // Add system publish audit log
      const auditPublish: HistoricoPost = {
        id: "h_" + Math.random().toString(36).substr(2, 9),
        post_id: postId,
        post_titulo: postTitle,
        usuario: "Sistema Automação",
        acao: "Publicado",
        observacao: `Publicação concluída com sucesso no feed oficial do Instagram! Post ID: ${igPostId}`,
        criado_em: new Date().toISOString()
      };
      
      dbFresh.historicos.unshift(auditPublish);
      saveDB(dbFresh);

      addLog(
        "Instagram API",
        "success",
        `Publicação concluída! O conteúdo '${postTitle}' está publicado. ID do Feed: ${igPostId}`,
        {
          instagram_permalink: `https://instagram.com/p/simulated_${igPostId}`,
          caption: `${post.legenda}\n\n${post.hashtags}`,
          media_source: post.drive_url
        }
      );

      // Check if uploaded, move file to "Instagram/Publicados" on simulated drive
      addLog(
        "Google Drive",
        "info",
        `Movendo mídia original '${post.drive_file_id || "arquivo"}' para a pasta /Publicados no Google Drive.`
      );
    }, 1500);

  }, 1000);
}

// Manual trigger for Scheduler tick check
app.post("/api/simulate-tick", (req, res) => {
  const processed = runSchedulerTick();
  res.json({ success: true, processedCount: processed });
});

function runSchedulerTick(): number {
  const db = loadDB();
  const now = new Date();
  let count = 0;

  db.posts.forEach(post => {
    if (post.status === "AGENDADA" && post.data_agendamento) {
      const scheduleTime = new Date(post.data_agendamento);
      if (scheduleTime <= now) {
        count++;
        post.status = "APROVADA";
        post.atualizado_em = now.toISOString();
        
        const audit: HistoricoPost = {
          id: "h_" + Math.random().toString(36).substr(2, 9),
          post_id: post.id,
          post_titulo: post.titulo,
          usuario: "Agendador Automático",
          acao: "Aprovado",
          observacao: `Horário de agendamento atingido (${scheduleTime.toLocaleString("pt-BR")}). Iniciando publicação.`,
          criado_em: now.toISOString()
        };
        db.historicos.unshift(audit);
        
        saveDB(db);
        addLog(
          "Scheduler",
          "info",
          `Agenda atingida para '${post.titulo}'. Ativando publicação automática.`
        );

        // Run publish flow
        publishToInstagramAPI(post, db, "Agendador Automático");
      }
    }
  });

  return count;
}

// Tick checking of Cron every 15 seconds on the server!
setInterval(() => {
  runSchedulerTick();
}, 15000);

// Get Audit history
app.get("/api/history", (req, res) => {
  const db = loadDB();
  res.json({ history: db.historicos });
});

// Get Sim logs
app.get("/api/logs", (req, res) => {
  const db = loadDB();
  res.json({ logs: db.logs });
});

app.post("/api/logs/clear", (req, res) => {
  const db = loadDB();
  db.logs = [];
  addLog("Database", "info", "Fila de logs do simulador limpa com sucesso.");
  res.json({ success: true });
});

// Get Settings
app.get("/api/settings", (req, res) => {
  const db = loadDB();
  res.json({ settings: db.settings });
});

// Update Settings
app.post("/api/settings", (req, res) => {
  const db = loadDB();
  const newSet = req.body;
  db.settings = { ...db.settings, ...newSet };
  saveDB(db);

  addLog(
    "Database",
    "success",
    "Configurações gerais do sistema atualizadas.",
    db.settings
  );
  res.json({ success: true, settings: db.settings });
});

// Get user list
app.get("/api/users", (req, res) => {
  const db = loadDB();
  res.json({ users: db.usuarios });
});

// LLM Caption generation endpoint
app.post("/api/gemini/generate-caption", async (req, res) => {
  const { title, prompt, type, hashtagsCount } = req.body;
  const count = hashtagsCount || 5;

  try {
    const ai = getGeminiClient();
    addLog(
      "Gemini AI",
      "info",
      `Enviando solicitação de criação de legenda para o modelo ${process.env.GEMINI_API_KEY ? "gemini-3.5-flash" : "Simulado"}...`,
      { title, prompt, postType: type }
    );

    const systemInstruction = 
      "Você é um gerente de mídias sociais especializado no Instagram com foco em engajamento " +
      "brasileiro. Retorne apenas uma resposta em formato JSON conforme solicitado, sem formatação Markdown adicional (sem tags ```json ... ``` ou texto extra). " +
      "Seja elegante, envolvente e focado no assunto fornecido.";

    const promptText = 
      `Gere uma legenda super engajadora e focada no Instagram para uma publicação com os seguintes dados:
      Título: "${title}"
      Tema/Instruções: "${prompt || 'Crie algo profissional e surpreendente sobre o tema'}"
      Tipo da Mídia: "${type}"
      
      Retorne obrigatoriamente um objeto JSON com as seguintes duas propriedades:
      "legenda": "Sua sugestão de legenda cativante, com quebras de linha ideais e emojis adequados.",
      "hashtags": "Uma string contendo exatamente ${count} hashtags estratégicas separadas por espaço (ex: '#tag1 #tag2 #tag3')."`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json"
      }
    });

    let textOut = response.text || "{}";
    // Sanitize any accidental markdown formatting the model might include
    textOut = textOut.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
    const result = JSON.parse(textOut);

    addLog(
      "Gemini AI",
      "success",
      "Sugestão de legenda e hashtags geradas com sucesso pelo Gemini API."
    );

    res.json({
      success: true,
      legenda: result.legenda || "",
      hashtags: result.hashtags || ""
    });

  } catch (error: any) {
    console.error("Erro na chamada Gemini:", error);
    addLog(
      "Gemini AI",
      "error",
      `Falha na geração com Gemini: ${error.message || "Erro desconhecido"}. Gerando fallback inteligente local.`
    );

    // Smart Fallback suggestions locally
    const fallbackHashtags = ["#instagramgrowth", `#postsde${type.toLowerCase()}`, "#sucesso", "#manager", "#produtividade"].slice(0, count).join(" ");
    const fallbackCaption = `✨ ${title} ✨\n\n${prompt ? prompt : "Acompanhe nossa jornada de excelência corporativa para otimizar os seus resultados diários. Fique atento às nossas redes para novidades exclusivas!"}\n\nConecte-se com nossa equipe! 💬👇`;

    res.json({
      success: true,
      legenda: fallbackCaption,
      hashtags: fallbackHashtags,
      isFallback: true,
      errorInfo: error.message
    });
  }
});


// -----------------------------------------------------------------------------
// VITE AND ASSETS ROUTING SETUP
// -----------------------------------------------------------------------------
async function bootstrap() {
  // Ensure storage DB exists on start
  loadDB();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[InstaPublish] Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
