// ─── E-mails transacionais via Resend ─────────────────────────────────────────
// Usa a API HTTP do Resend diretamente (sem dependência npm).
// Todos os envios são fail-soft: falha de e-mail nunca derruba um webhook —
// retornamos { ok, reason } e quem chama loga/registra.
//
// Cada template existe em pt-BR, en e es — o idioma vem de users.locale
// (capturado na compra: Stripe session.locale / Kiwify → pt-BR).

import type { AppLocale } from "@/lib/locale";
import type { createServiceSupabaseClient } from "@/lib/supabase";

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

export interface EmailResult {
  ok: boolean;
  reason?: string;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY não configurada — e-mail não enviado");
    return { ok: false, reason: "resend_not_configured" };
  }
  if (!opts.to) return { ok: false, reason: "no_recipient" };

  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[Email] Resend retornou status", res.status);
      return { ok: false, reason: `resend_http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error(
      "[Email] Falha ao enviar:",
      err instanceof Error ? err.message : ""
    );
    return { ok: false, reason: "email_exception" };
  } finally {
    clearTimeout(timer);
  }
}

// Layout base místico (dark + dourado) compartilhado por todos os templates.
function mysticLayout(inner: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a14;font-family:Georgia,serif;color:#e8e0d0;">
<div style="max-width:560px;margin:0 auto;padding:30px 20px;">
  <div style="background:linear-gradient(135deg,#15102a,#1f1640,#15102a);border-radius:20px;padding:40px 28px;text-align:center;border:2px solid rgba(201,168,76,0.4);">
    ${inner}
  </div>
  <div style="text-align:center;margin-top:20px;color:#666;font-size:12px;">ATB TAROT</div>
</div></body></html>`;
}

function goldButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#a8862e);color:#0a0a14;font-weight:800;font-size:19px;padding:18px 34px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(201,168,76,0.4);">${label}</a>`;
}

// ─── E-mail de acesso pós-compra ─────────────────────────────────────────────
// Enviado pelos webhooks após provisionar o acesso. Inclui um magic link
// (gerado via Supabase Admin) que loga o comprador direto no dashboard;
// se a geração do link falhar, cai no link da página de login.
const ACCESS_COPY: Record<
  AppLocale,
  {
    subject: string;
    title: string;
    body: (firstName: string) => string;
    cta: string;
    fallback: (loginUrl: string) => string;
  }
> = {
  "pt-BR": {
    subject: "🔮 Seu acesso ao ATB TAROT está liberado",
    title: "Sua jornada começou",
    body: (n) =>
      `Olá, <strong style="color:#c9a84c;">${n}</strong>!<br>Que bom te ver por aqui. Sua compra foi confirmada e o seu portal já está aberto — toque no botão dourado e venha:`,
    cta: "✦ Acessar meu portal",
    fallback: (url) =>
      `Se o botão expirar, acesse <a href="${url}" style="color:#c9a84c;">a página de login</a> e peça um novo link mágico com este mesmo e-mail.`,
  },
  en: {
    subject: "🔮 Your ATB TAROT access is ready",
    title: "Your journey has begun",
    body: (n) =>
      `Hello, <strong style="color:#c9a84c;">${n}</strong>!<br>So good to have you here. Your purchase is confirmed and your portal is already open — tap the golden button and come in:`,
    cta: "✦ Access my portal",
    fallback: (url) =>
      `If the button expires, go to <a href="${url}" style="color:#c9a84c;">the login page</a> and request a new magic link with this same email.`,
  },
  es: {
    subject: "🔮 Tu acceso a ATB TAROT está listo",
    title: "Tu viaje ha comenzado",
    body: (n) =>
      `Hola, <strong style="color:#c9a84c;">${n}</strong>!<br>Qué bueno tenerte aquí. Tu compra fue confirmada y tu portal ya está abierto — toca el botón dorado y entra:`,
    cta: "✦ Acceder a mi portal",
    fallback: (url) =>
      `Si el botón expira, ve a <a href="${url}" style="color:#c9a84c;">la página de inicio de sesión</a> y pide un nuevo enlace mágico con este mismo correo.`,
  },
  de: {
    subject: "🔮 Dein Zugang zu ATB TAROT ist bereit",
    title: "Deine Reise hat begonnen",
    body: (n) =>
      `Hallo, <strong style="color:#c9a84c;">${n}</strong>!<br>Schön, dass du da bist. Dein Kauf wurde bestätigt und dein Portal ist schon offen — tippe auf den goldenen Knopf und komm herein:`,
    cta: "✦ Mein Portal öffnen",
    fallback: (url) =>
      `Wenn der Knopf abgelaufen ist, gehe zur <a href="${url}" style="color:#c9a84c;">Anmeldeseite</a> und fordere mit derselben E-Mail-Adresse einen neuen magischen Link an.`,
  },
  it: {
    subject: "🔮 Il tuo accesso ad ATB TAROT è pronto",
    title: "Il tuo viaggio è iniziato",
    body: (n) =>
      `Ciao, <strong style="color:#c9a84c;">${n}</strong>!<br>Che bello averti qui. Il tuo acquisto è stato confermato e il tuo portale è già aperto — tocca il pulsante dorato ed entra:`,
    cta: "✦ Accedi al mio portale",
    fallback: (url) =>
      `Se il pulsante è scaduto, vai alla <a href="${url}" style="color:#c9a84c;">pagina di accesso</a> e richiedi un nuovo link magico con questa stessa e-mail.`,
  },
};

export async function sendAccessEmail(
  supabase: ServiceClient,
  opts: {
    email: string;
    nome?: string | null;
    locale: AppLocale;
    baseUrl: string;
  }
): Promise<EmailResult> {
  const copy = ACCESS_COPY[opts.locale];
  const firstName =
    escapeHtml((opts.nome ?? "").trim().split(/\s+/)[0]) ||
    (opts.locale === "en" ? "dear soul" : opts.locale === "es" ? "querida alma" : "querida alma");

  // Magic link de acesso direto. Usamos o hashed_token apontando para o
  // NOSSO callback (?token_hash=), que chama verifyOtp server-side — o
  // action_link bruto do Supabase não funciona aqui porque o fluxo PKCE
  // exige um code_verifier que só existe quando o login começa no browser.
  let actionLink = `${opts.baseUrl}/login`;
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: opts.email,
    });
    const hashedToken = data?.properties?.hashed_token;
    if (!error && hashedToken) {
      actionLink = `${opts.baseUrl}/api/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&next=/dashboard`;
    }
  } catch {
    // mantém o fallback /login
  }

  const loginUrl = `${opts.baseUrl}/login`;
  const html = mysticLayout(`
    <div style="font-size:56px;margin-bottom:14px;">🔮</div>
    <h1 style="color:#c9a84c;font-size:28px;margin:0 0 14px;">${copy.title}</h1>
    <p style="font-size:17px;line-height:1.65;margin:0 0 24px;">${copy.body(firstName)}</p>
    ${goldButton(actionLink, copy.cta)}
    <p style="color:#9a8f78;font-size:13px;line-height:1.6;margin:26px 0 0;">${copy.fallback(loginUrl)}</p>
  `);

  return sendEmail({ to: opts.email, subject: copy.subject, html });
}

// ─── E-mail de entrega da Limpeza Espiritual ─────────────────────────────────
const LIMPEZA_COPY: Record<
  AppLocale,
  {
    subject: string;
    title: string;
    body: (firstName: string) => string;
    cta: string;
    note: string;
  }
> = {
  "pt-BR": {
    subject: "🕊️ Sua Limpeza Espiritual está pronta",
    title: "Sua Limpeza está pronta",
    body: (n) =>
      `<strong style="color:#c9a84c;">${n}</strong>, é a ATB.<br>Terminei agora a sua Limpeza Espiritual. Está tudo aqui — toque no botão e leia com calma:`,
    cta: "✨ Abrir minha Limpeza",
    note: "Guarde este e-mail — o link é seu acesso permanente à sua limpeza.",
  },
  en: {
    subject: "🕊️ Your Spiritual Cleansing is ready",
    title: "Your Cleansing is ready",
    body: (n) =>
      `<strong style="color:#c9a84c;">${n}</strong>, it's ATB.<br>I've just finished your Spiritual Cleansing. It's all here — tap the button and read it calmly:`,
    cta: "✨ Open my Cleansing",
    note: "Keep this email — the link is your permanent access to your cleansing.",
  },
  es: {
    subject: "🕊️ Tu Limpieza Espiritual está lista",
    title: "Tu Limpieza está lista",
    body: (n) =>
      `<strong style="color:#c9a84c;">${n}</strong>, soy ATB.<br>Acabo de terminar tu Limpieza Espiritual. Está todo aquí — toca el botón y léelo con calma:`,
    cta: "✨ Abrir mi Limpieza",
    note: "Guarda este correo — el enlace es tu acceso permanente a tu limpieza.",
  },
  de: {
    subject: "🕊️ Deine Spirituelle Reinigung ist bereit",
    title: "Deine Reinigung ist bereit",
    body: (n) =>
      `<strong style="color:#c9a84c;">${n}</strong>, hier ist ATB.<br>Ich habe deine Spirituelle Reinigung gerade fertig gemacht. Hier ist alles — tippe auf den Knopf und lies es in Ruhe:`,
    cta: "✨ Meine Reinigung öffnen",
    note: "Bewahre diese E-Mail auf — der Link ist dein dauerhafter Zugang zu deiner Reinigung.",
  },
  it: {
    subject: "🕊️ La tua Pulizia Spirituale è pronta",
    title: "La tua Pulizia è pronta",
    body: (n) =>
      `<strong style="color:#c9a84c;">${n}</strong>, sono ATB.<br>Ho appena finito la tua Pulizia Spirituale. È tutto qui — tocca il pulsante e leggila con calma:`,
    cta: "✨ Apri la mia Pulizia",
    note: "Conserva questa e-mail — il link è il tuo accesso permanente alla tua pulizia.",
  },
};

export async function sendLimpezaEmail(opts: {
  email: string;
  nome?: string | null;
  locale: AppLocale;
  deliveryLink: string;
}): Promise<EmailResult> {
  const copy = LIMPEZA_COPY[opts.locale];
  const firstName =
    escapeHtml((opts.nome ?? "").trim().split(/\s+/)[0]) ||
    (opts.locale === "en" ? "dear soul" : "querida alma");

  const html = mysticLayout(`
    <div style="font-size:56px;margin-bottom:14px;">🕊️</div>
    <h1 style="color:#c9a84c;font-size:28px;margin:0 0 14px;">${copy.title}</h1>
    <p style="font-size:17px;line-height:1.65;margin:0 0 24px;">${copy.body(firstName)}</p>
    ${goldButton(opts.deliveryLink, copy.cta)}
    <p style="color:#9a8f78;font-size:13px;line-height:1.6;margin:26px 0 0;">${copy.note}</p>
  `);

  return sendEmail({ to: opts.email, subject: copy.subject, html });
}

// ─── E-mail de confirmação dos Trabalhos Espirituais ─────────────────────────
// Equivalente ao WhatsApp de confirmação: orientação de preparação + pedido
// do nome completo e da intenção. A copy final substituirá este texto.
// Compliance: nunca afirma ritual realizado; nunca promete resultado.
export async function sendServicoConfirmacaoEmail(opts: {
  email: string;
  nome?: string | null;
  servicoNome: string;
  temWhatsapp: boolean;
}): Promise<EmailResult> {
  const firstName =
    escapeHtml((opts.nome ?? "").trim().split(/\s+/)[0]) || "querida alma";
  const servico = escapeHtml(opts.servicoNome);

  const canalResposta = opts.temWhatsapp
    ? "Responda a mensagem que a ATB te enviou no <strong>WhatsApp</strong>"
    : "Responda este e-mail";

  const html = mysticLayout(`
    <div style="font-size:56px;margin-bottom:14px;">🕊️</div>
    <h1 style="color:#c9a84c;font-size:28px;margin:0 0 14px;">Seu pedido foi recebido</h1>
    <p style="font-size:17px;line-height:1.65;margin:0 0 18px;">
      Olá, <strong style="color:#c9a84c;">${firstName}</strong>!<br>
      Sua compra do trabalho <strong style="color:#c9a84c;">${servico}</strong> foi confirmada.
      Seu ritual será preparado e realizado individualmente, com o seu nome,
      em até <strong>48 horas úteis</strong>.
    </p>
    <div style="text-align:left;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);border-radius:14px;padding:20px;margin:0 0 18px;">
      <p style="color:#c9a84c;font-size:16px;font-weight:800;margin:0 0 10px;">✦ O que fazer agora</p>
      <p style="font-size:16px;line-height:1.7;margin:0;">
        ${canalResposta} com:<br>
        1. Seu <strong>nome completo</strong><br>
        2. A sua <strong>intenção</strong> — o que você deseja trabalhar neste ritual
      </p>
    </div>
    <p style="font-size:16px;line-height:1.65;margin:0 0 18px;">
      Assim que o ritual for realizado, você recebe o registro do trabalho
      (foto e/ou áudio) e as orientações no seu WhatsApp.
    </p>
    <p style="color:#9a8f78;font-size:13px;line-height:1.6;margin:20px 0 0;">
      Serviço de natureza espiritual e religiosa. Não substitui acompanhamento
      médico, psicológico, jurídico ou financeiro. Você tem até 7 dias corridos
      após a compra para pedir reembolso integral (art. 49 do CDC).
    </p>
  `);

  return sendEmail({
    to: opts.email,
    subject: `🕊️ Seu trabalho "${opts.servicoNome}" foi confirmado`,
    html,
  });
}

// ─── Notificação de venda para o admin ───────────────────────────────────────
export async function sendAdminSaleNotification(opts: {
  plan: string;
  email: string;
  nome?: string | null;
  amountCents?: number | null;
  currency?: string;
  provider: "kiwify" | "stripe";
}): Promise<EmailResult> {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  if (!adminEmail) return { ok: false, reason: "no_admin_email" };

  const amount =
    typeof opts.amountCents === "number"
      ? `${((opts.currency ?? "brl") === "jpy" ? opts.amountCents : opts.amountCents / 100).toFixed(2)} ${(opts.currency ?? "BRL").toUpperCase()}`
      : "N/A";

  return sendEmail({
    to: adminEmail,
    subject: `💰 Nova venda: ${opts.plan} (${opts.provider})`,
    html: `<p><strong>Produto:</strong> ${escapeHtml(opts.plan)}</p>
<p><strong>Cliente:</strong> ${escapeHtml(opts.nome) || "Não informado"}</p>
<p><strong>E-mail:</strong> ${escapeHtml(opts.email)}</p>
<p><strong>Valor:</strong> ${amount}</p>
<p><strong>Gateway:</strong> ${opts.provider}</p>`,
  });
}
