// Re-adiciona as envs de produção na Vercel lendo o .env.local —
// via stdin SEM BOM e SEM newline (o pipe do PowerShell contamina os valores).
// Uso: node scripts/set-vercel-envs.js [NOME1 NOME2 ...]  (sem args = lista padrão)
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectDir = path.join(__dirname, "..");
const envFile = path.join(projectDir, ".env.local");

const DEFAULT_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ADMIN_NOTIFY_EMAIL",
  "KIWIFY_WEBHOOK_TOKEN",
  "NEXT_PUBLIC_KIWIFY_BASIC_URL",
  "NEXT_PUBLIC_KIWIFY_PREMIUM_URL",
  "NEXT_PUBLIC_KIWIFY_LIMPEZA_URL",
  "NEXT_PUBLIC_KIWIFY_PERGUNTA1_URL",
  "NEXT_PUBLIC_KIWIFY_PERGUNTA3_URL",
  "NEXT_PUBLIC_KIWIFY_PERGUNTA7_URL",
  "KIWIFY_PRODUCT_BASIC",
  "KIWIFY_PRODUCT_PREMIUM",
  "KIWIFY_PRODUCT_LIMPEZA",
  "KIWIFY_PRODUCT_PERGUNTA1",
  "KIWIFY_PRODUCT_PERGUNTA3",
  "KIWIFY_PRODUCT_PERGUNTA7",
  "INTERNAL_GEN_TOKEN",
  "NEXT_PUBLIC_APP_URL",
];

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_VARS;

const vars = {};
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
  if (m) vars[m[1]] = m[2].trim();
}

function vercel(args, input) {
  // shell:true é exigido pelo Node moderno para executar npx.cmd no Windows.
  // Os argumentos não contêm espaços (projectDir sem espaços), então a
  // concatenação simples é segura.
  return spawnSync(["npx", "vercel", ...args, "--cwd", projectDir].join(" "), {
    input,
    encoding: "utf8",
    shell: true,
    windowsHide: true,
  });
}

for (const name of wanted) {
  const value = vars[name];
  if (!value) {
    console.log(`PULADO (vazio): ${name}`);
    continue;
  }
  vercel(["env", "rm", name, "production", "--yes"]);
  const res = vercel(["env", "add", name, "production"], value);
  const out = `${res.stdout}\n${res.stderr}`;
  console.log(out.includes("Added") ? `OK: ${name}` : `FALHOU: ${name} => ${out.trim().slice(-200)}`);
}
