// Consulta rápida ao Supabase de produção via service key (REST PostgREST).
// Uso: node scripts/db-query.js "<path REST com query string>"
// Ex.: node scripts/db-query.js "limpeza_orders?select=id,status&limit=5"
const fs = require("fs");
const path = require("path");

const envFile = path.join(__dirname, "..", ".env.local");
const vars = {};
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
  if (m) vars[m[1]] = m[2].trim();
}

const url = vars.NEXT_PUBLIC_SUPABASE_URL;
const key = vars.SUPABASE_SERVICE_ROLE_KEY;
const q = process.argv[2];
if (!q) {
  console.error("informe a query REST");
  process.exit(1);
}

(async () => {
  const res = await fetch(`${url}/rest/v1/${q}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    process.exit(1);
  }
  console.log(JSON.stringify(JSON.parse(body), null, 1));
})();
