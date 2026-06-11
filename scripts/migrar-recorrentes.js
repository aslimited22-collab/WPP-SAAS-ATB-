// Migração dos assinantes recorrentes do app antigo para o portal novo:
// 1. Lê users com plan basic/premium do Supabase ANTIGO (somente leitura)
// 2. Provisiona no Supabase NOVO: auth user + users + subscriptions + credits
// 3. Envia e-mail (Resend) com o novo link de acesso
// Idempotente: upserts com chaves estáveis; e-mail só na primeira execução
// (controlado por audit_logs action=MIGRACAO_EMAIL_ENVIADO).
// Uso: node scripts/migrar-recorrentes.js [--so-preview]
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
const OLD = readEnv("C:/Users/arthu/OneDrive/Desktop/SAAS DEFINITIVO MPV ATB/.env.local");

const soPreview = process.argv.includes("--so-preview");
const APP = "https://atbtartot.com";

function novoHeaders(extra = {}) {
  return {
    apikey: NEW.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${NEW.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function emailHtml(nome, email) {
  const firstName = (nome ?? "").trim().split(/\s+/)[0] || "querida alma";
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a14;font-family:Georgia,serif;color:#e8e0d0;">
<div style="max-width:560px;margin:0 auto;padding:30px 20px;">
  <div style="background:linear-gradient(135deg,#15102a,#1f1640,#15102a);border-radius:20px;padding:40px 28px;text-align:center;border:2px solid rgba(201,168,76,0.4);">
    <div style="font-size:56px;margin-bottom:14px;">🔮</div>
    <h1 style="color:#c9a84c;font-size:28px;margin:0 0 14px;">Seu portal ganhou casa nova</h1>
    <p style="font-size:17px;line-height:1.65;margin:0 0 10px;">Olá, <strong style="color:#c9a84c;">${esc(firstName)}</strong>!</p>
    <p style="font-size:17px;line-height:1.65;margin:0 0 24px;">Minha querida alma, o portal ATB TAROT IA mudou para um endereço novo, mais bonito e mais fácil de usar. <strong style="color:#c9a84c;">Sua assinatura continua exatamente igual</strong> — você não paga nada a mais por isso.</p>
    <a href="${APP}/login" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#a8862e);color:#0a0a14;font-weight:800;font-size:19px;padding:18px 34px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(201,168,76,0.4);">✦ Entrar no meu novo portal</a>
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

async function jaEnviado(email) {
  const r = await fetch(
    `${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_logs?select=id&action=eq.MIGRACAO_EMAIL_ENVIADO&metadata->>email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: novoHeaders() }
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

(async () => {
  // 1. Lista do app antigo
  const oldRes = await fetch(
    `${OLD.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=email,name,plan&plan=in.(basic,premium)&order=created_at.asc`,
    { headers: { apikey: OLD.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${OLD.SUPABASE_SERVICE_ROLE_KEY}` } }
  );
  const antigos = await oldRes.json();
  console.log(`Recorrentes no app antigo: ${antigos.length}`);
  if (soPreview) {
    console.log(emailHtml("Maria Exemplo", "exemplo@gmail.com").slice(0, 400));
    return;
  }

  let ok = 0, pulados = 0, falhas = 0;
  for (const u of antigos) {
    const email = u.email.toLowerCase().trim();
    const plan = u.plan === "premium" ? "premium" : "basic";
    try {
      if (await jaEnviado(email)) {
        console.log(`PULADO (já migrado): ${email}`);
        pulados++;
        continue;
      }

      // 2a. Cria/resolve usuário no Auth do app novo
      let userId = null;
      const create = await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: novoHeaders(),
        body: JSON.stringify({ email, email_confirm: true }),
      });
      const created = await create.json();
      if (create.ok && created.id) {
        userId = created.id;
      } else {
        // Já existe — busca em public.users
        const ex = await fetch(
          `${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=id&email=eq.${encodeURIComponent(email)}&limit=1`,
          { headers: novoHeaders() }
        );
        const exRows = await ex.json();
        if (exRows.length) userId = exRows[0].id;
      }
      if (!userId) throw new Error("sem userId: " + JSON.stringify(created).slice(0, 120));

      // 2b. users (não sobrescreve nome com vazio)
      const userRow = { id: userId, email, plan, locale: "pt-BR" };
      if (u.name) userRow.nome = String(u.name).slice(0, 100);
      await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?on_conflict=id`, {
        method: "POST",
        headers: novoHeaders({ Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify(userRow),
      });

      // 2c. subscription ativa (chave estável p/ idempotência; a próxima
      // renovação real da Kiwify cria/atualiza a linha definitiva)
      await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/subscriptions?on_conflict=kiwify_transaction_id`, {
        method: "POST",
        headers: novoHeaders({ Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify({
          user_id: userId,
          status: "active",
          kiwify_transaction_id: "migracao-" + email.replace(/[^a-z0-9]/g, "-").slice(0, 80),
          renovacao_em: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        }),
      });

      // 2d. créditos de leitura do plano
      await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/credits?on_conflict=user_id`, {
        method: "POST",
        headers: novoHeaders({ Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify({
          user_id: userId,
          leituras_restantes: plan === "premium" ? 999 : 5,
          mes_referencia: new Date().toISOString().slice(0, 7),
          updated_at: new Date().toISOString(),
        }),
      });

      // 3. E-mail de migração
      const send = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${NEW.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: NEW.RESEND_FROM_EMAIL,
          to: email,
          subject: "🔮 Seu portal ATB TAROT IA mudou — seu novo acesso está aqui",
          html: emailHtml(u.name, email),
        }),
      });
      if (!send.ok) throw new Error("resend " + send.status + ": " + (await send.text()).slice(0, 120));

      // 4. Marca como migrado
      await fetch(`${NEW.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_logs`, {
        method: "POST",
        headers: novoHeaders(),
        body: JSON.stringify({
          user_id: userId,
          action: "MIGRACAO_EMAIL_ENVIADO",
          metadata: { email, plan, origem: "app-antigo" },
        }),
      });

      console.log(`OK: ${email} (${plan})`);
      ok++;
      await new Promise((r) => setTimeout(r, 700)); // rate limit Resend
    } catch (e) {
      console.error(`FALHA: ${email} — ${e.message.slice(0, 160)}`);
      falhas++;
    }
  }
  console.log(`\nRESUMO: ${ok} migrados+emails, ${pulados} pulados, ${falhas} falhas`);
})();
