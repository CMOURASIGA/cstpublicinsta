import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const requiredTables = [
  "clientes",
  "cliente_usuarios",
  "cliente_integracoes",
  "sistema_configuracoes",
  "cliente_configuracoes",
  "parametro_auditoria",
  "posts",
  "usuarios",
  "historico_posts",
  "logs",
];
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env.local.");
  process.exit(1);
}

const missingTables = [];

for (const table of requiredTables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (response.ok) {
    console.log(`OK ${table}`);
    continue;
  }

  const payload = await response.text();
  if (payload.includes("PGRST205")) {
    missingTables.push(table);
    console.log(`MISSING ${table}`);
    continue;
  }

  if (payload.includes('"code":"42501"')) {
    missingTables.push(`${table} (permissão service_role ausente)`);
    console.log(`PERMISSION ${table}`);
    continue;
  }

  console.error(`ERROR ${table}: ${payload}`);
  process.exit(1);
}

if (missingTables.length > 0) {
  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const hasSchema = fs.existsSync(schemaPath);
  console.error(`Schema incompleto. Tabelas ausentes: ${missingTables.join(", ")}`);
  if (hasSchema) {
    console.error(`Aplique o arquivo ${schemaPath} no projeto Supabase para concluir o bootstrap.`);
  }
  process.exit(2);
}

console.log("Schema Supabase válido.");
