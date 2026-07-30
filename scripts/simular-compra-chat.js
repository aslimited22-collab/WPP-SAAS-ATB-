// Simula uma compra de pergunta7 (7 créditos de chat) para um e-mail:
// provisiona igual ao webhook e envia o MESMO e-mail de acesso pós-compra
// (botão dourado com magic link token_hash → login direto no dashboard).
// Uso: node scripts/simular-compra-chat.js <email> [creditos]
const fs = require("fs");
const path = require("path");

const vars = {};
for (const line of fs
  .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
  if (m) vars[m[1]] = m[2].trim();
}

const email = (process.argv[2] ?? "").toLowerCase().trim();
const creditos = parseInt(process.argv[3] ?? "7", 10);
const URL = vars.NEXT_PUBLIC_SUPABASE_URL;
const APP = "https://atbtartot.com";

function h(extra = {}) {
  return {
    apikey: vars.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${vars.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

(async () => {
  if (!email) {
    console.error("informe o e-mail");
    process.exit(1);
  }

  // 1. Criar/achar usuário no Auth
  let userId = null;
  const create = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: h(),
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const created = await create.json();
  if (create.ok && created.id) {
    userId = created.id;
    console.log("1. Usuário criado no Auth:", userId);
  } else {
    const list = await fetch(
      `${URL}/auth/v1/admin/users?page=1&per_page=200`,
      { headers: h() }
    );
    const data = await list.json();
    const found = (data.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === email
    );
    if (!found) {
      console.error("não achou usuário:", JSON.stringify(created).slice(0, 150));
      process.exit(1);
    }
    userId = found.id;
    console.log("1. Usuário já existia no Auth:", userId);
  }

  // 2. users row
  await fetch(`${URL}/rest/v1/users?on_conflict=id`, {
    method: "POST",
    headers: h({ Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ id: userId, email, locale: "pt-BR" }),
  });
  console.log("2. users row ok");

  // 3. Créditos de chat (RPC atômica, igual ao webhook)
  const rpc = await fetch(`${URL}/rest/v1/rpc/grant_chat_credits`, {
    method: "POST",
    headers: h(),
    body: JSON.stringify({ p_user_id: userId, p_amount: creditos }),
  });
  if (!rpc.ok) {
    console.error("grant_chat_credits falhou:", rpc.status, (await rpc.text()).slice(0, 200));
    process.exit(1);
  }
  console.log(`3. +${creditos} créditos de chat concedidos`);

  // 4. Magic link (mesmo mecanismo do e-mail de acesso real)
  const gl = await fetch(`${URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: h(),
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const glData = await gl.json();
  const hashed = glData.hashed_token ?? glData.properties?.hashed_token;
  if (!hashed) {
    console.error("sem hashed_token:", JSON.stringify(glData).slice(0, 200));
    process.exit(1);
  }
  const actionLink = `${APP}/api/auth/callback?token_hash=${encodeURIComponent(hashed)}&next=/dashboard`;
  console.log("4. magic link gerado");

  // 5. E-mail de acesso (mesmo template do pós-compra real)
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a14;font-family:Georgia,serif;color:#e8e0d0;">
<div style="max-width:560px;margin:0 auto;padding:30px 20px;">
  <div style="background:linear-gradient(135deg,#15102a,#1f1640,#15102a);border-radius:20px;padding:40px 28px;text-align:center;border:2px solid rgba(201,168,76,0.4);">
    <div style="font-size:56px;margin-bottom:14px;">🔮</div>
    <h1 style="color:#c9a84c;font-size:28px;margin:0 0 14px;">Sua jornada começou</h1>
    <p style="font-size:17px;line-height:1.65;margin:0 0 24px;">Olá, <strong style="color:#c9a84c;">querida alma</strong>!<br>Sua compra foi confirmada e seu portal já está aberto. Você tem <strong style="color:#c9a84c;">${creditos} perguntas</strong> para conversar com a ATB. Toque no botão dourado para entrar agora:</p>
    <a href="${actionLink}" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#a8862e);color:#0a0a14;font-weight:800;font-size:19px;padding:18px 34px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(201,168,76,0.4);">✦ Acessar meu portal</a>
    <p style="color:#9a8f78;font-size:13px;line-height:1.6;margin:26px 0 0;">Se o botão expirar, acesse <a href="${APP}/login" style="color:#c9a84c;">a página de login</a> e peça um novo link mágico com este mesmo e-mail.</p>
  </div>
  <div style="text-align:center;margin-top:20px;color:#666;font-size:12px;">ATB TAROT</div>
</div></body></html>`;

  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${vars.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: vars.RESEND_FROM_EMAIL,
      to: email,
      subject: "🔮 Seu acesso ao ATB TAROT está liberado",
      html,
    }),
  });
  if (!send.ok) {
    console.error("e-mail falhou:", send.status, (await send.text()).slice(0, 200));
    process.exit(1);
  }
  console.log("5. E-MAIL DE ACESSO ENVIADO para", email);

  // 6. Saldo final
  const check = await fetch(
    `${URL}/rest/v1/users?id=eq.${userId}&select=email,chat_credits_balance,locale`,
    { headers: h() }
  );
  console.log("6. Estado:", JSON.stringify(await check.json()));
})();
