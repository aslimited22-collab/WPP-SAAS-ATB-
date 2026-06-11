// Completa a migração das 3 contas que já existiam no Auth do app novo
// (clientes que tentaram logar após a troca de domínio) mas sem provisionamento.
const fs = require("fs");
const path = require("path");

function readEnv(file) {
  const vars = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
  return vars;
}

const NEW = readEnv(path.join(__dirname, "..", ".env.local"));
const { emailHtml } = (() => {
  // reaproveita o template do script principal por require dinâmico simples
  return { emailHtml: null };
})();

const FALTANTES = [
  { email: "barkert.josi@gmail.com", name: "Josiéli", plan: "premium" },
  { email: "mariadossantoss836@gmail.com", name: "Maria dos remédios da Costa Santos", plan: "premium" },
  { email: "josi@barkert.com.br", name: "", plan: "premium" },
];

function h(extra = {}) {
  return {
    apikey: NEW.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${NEW.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function html(nome, email) {
  const firstName = (nome ?? "").trim().split(/\s+/)[0] || "querida alma";
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a14;font-family:Georgia,serif;color:#e8e0d0;">
<div style="max-width:560px;margin:0 auto;padding:30px 20px;">
  <div style="background:linear-gradient(135deg,#15102a,#1f1640,#15102a);border-radius:20px;padding:40px 28px;text-align:center;border:2px solid rgba(201,168,76,0.4);">
    <div style="font-size:56px;margin-bottom:14px;">🔮</div>
    <h1 style="color:#c9a84c;font-size:28px;margin:0 0 14px;">Seu portal ganhou casa nova</h1>
    <p style="font-size:17px;line-height:1.65;margin:0 0 10px;">Olá, <strong style="color:#c9a84c;">${esc(firstName)}</strong>!</p>
    <p style="font-size:17px;line-height:1.65;margin:0 0 24px;">Minha querida alma, o portal ATB TAROT IA mudou para um endereço novo, mais bonito e mais fácil de usar. <strong style="color:#c9a84c;">Sua assinatura continua exatamente igual</strong> — você não paga nada a mais por isso.</p>
    <a href="https://atbtartot.com/login" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#a8862e);color:#0a0a14;font-weight:800;font-size:19px;padding:18px 34px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(201,168,76,0.4);">✦ Entrar no meu novo portal</a>
  </div>
  <div style="margin-top:20px;padding:20px 22px;background:rgba(201,168,76,0.08);border:1.5px solid rgba(201,168,76,0.3);border-radius:14px;text-align:left;">
    <div style="font-size:17px;font-weight:700;color:#c9a84c;margin-bottom:10px;">✦ É bem fácil entrar:</div>
    <ol style="font-size:16px;line-height:1.8;padding-left:22px;margin:0;color:#e8e0d0;">
      <li>Aperte o botão dourado acima</li>
      <li>Digite este mesmo e-mail: <strong style="color:#c9a84c;">${esc(email)}</strong></li>
      <li>Abra o e-mail que chega e toque no botão — pronto, você está dentro!</li>
    </ol>
  </div>
  <div style="text-align:center;margin-top:24px;color:#9a8f78;font-size:13px;line-height:1.6;">
    Lá dentro você conversa com a ATB no chat, pede suas leituras de tarot<br>e recebe tudo no WhatsApp — com letras grandes e fáceis.<br><br>Com amor e luz, ATB TAROT IA 💛
  </div>
</div></body></html>`;
}

(async () => {
  // Lista usuários do Auth (poucas contas no app novo — 1 página resolve)
  const list = await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: h() });
  const data = await list.json();
  const authUsers = data.users ?? [];
  console.log("Usuários no Auth do app novo:", authUsers.length);

  for (const f of FALTANTES) {
    const found = authUsers.find((u) => (u.email ?? "").toLowerCase() === f.email);
    if (!found) {
      console.error(`NAO ACHOU no Auth: ${f.email}`);
      continue;
    }
    const userId = found.id;

    const userRow = { id: userId, email: f.email, plan: f.plan, locale: "pt-BR" };
    if (f.name) userRow.nome = f.name.slice(0, 100);
    await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?on_conflict=id`, {
      method: "POST",
      headers: h({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify(userRow),
    });

    await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/subscriptions?on_conflict=kiwify_transaction_id`, {
      method: "POST",
      headers: h({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        user_id: userId,
        status: "active",
        kiwify_transaction_id: "migracao-" + f.email.replace(/[^a-z0-9]/g, "-").slice(0, 80),
        renovacao_em: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      }),
    });

    await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/credits?on_conflict=user_id`, {
      method: "POST",
      headers: h({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        user_id: userId,
        leituras_restantes: f.plan === "premium" ? 999 : 5,
        mes_referencia: new Date().toISOString().slice(0, 7),
        updated_at: new Date().toISOString(),
      }),
    });

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NEW.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: NEW.RESEND_FROM_EMAIL,
        to: f.email,
        subject: "🔮 Seu portal ATB TAROT IA mudou — seu novo acesso está aqui",
        html: html(f.name, f.email),
      }),
    });
    if (!send.ok) {
      console.error(`EMAIL FALHOU: ${f.email} — ${send.status}`);
      continue;
    }

    await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_logs`, {
      method: "POST",
      headers: h(),
      body: JSON.stringify({
        user_id: userId,
        action: "MIGRACAO_EMAIL_ENVIADO",
        metadata: { email: f.email, plan: f.plan, origem: "app-antigo-auth-existente" },
      }),
    });

    console.log(`OK: ${f.email} (${f.plan})`);
    await new Promise((r) => setTimeout(r, 700));
  }
})();
