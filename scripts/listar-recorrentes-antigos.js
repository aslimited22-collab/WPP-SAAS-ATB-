// Lista os assinantes RECORRENTES do app antigo (SAAS DEFINITIVO / SAAS ATB):
// users com plan basic/premium (cancelados voltam para "free" via webhook).
// Apenas leitura — não altera nada.
const fs = require("fs");

const OLD_ENV = "C:/Users/arthu/OneDrive/Desktop/SAAS DEFINITIVO MPV ATB/.env.local";
const vars = {};
for (const line of fs.readFileSync(OLD_ENV, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
  if (m) vars[m[1]] = m[2].trim();
}

const url = vars.NEXT_PUBLIC_SUPABASE_URL;
const key = vars.SUPABASE_SERVICE_ROLE_KEY;

(async () => {
  const res = await fetch(
    `${url}/rest/v1/users?select=email,name,plan,created_at&plan=in.(basic,premium)&order=created_at.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) {
    console.error("HTTP", res.status, (await res.text()).slice(0, 300));
    process.exit(1);
  }
  const rows = await res.json();
  console.log(`TOTAL recorrentes (basic/premium): ${rows.length}`);
  for (const r of rows) {
    console.log(`${r.plan.padEnd(7)} | ${r.email} | ${r.name ?? "(sem nome)"} | desde ${r.created_at?.slice(0, 10)}`);
  }
})();
