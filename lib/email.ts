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
  <div style="text-align:center;margin-top:20px;color:#666;font-size:12px;">ATB TAROT IA</div>
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
    subject: "🔮 Seu acesso ao ATB TAROT IA está liberado",
    title: "Sua jornada começou",
    body: (n) =>
      `Olá, <strong style="color:#c9a84c;">${n}</strong>!<br>Sua compra foi confirmada e seu portal já está aberto. Toque no botão dourado para entrar agora:`,
    cta: "✦ Acessar meu portal",
    fallback: (url) =>
      `Se o botão expirar, acesse <a href="${url}" style="color:#c9a84c;">a página de login</a> e peça um novo link mágico com este mesmo e-mail.`,
  },
  en: {
    subject: "🔮 Your ATB TAROT AI access is ready",
    title: "Your journey has begun",
    body: (n) =>
      `Hello, <strong style="color:#c9a84c;">${n}</strong>!<br>Your purchase is confirmed and your portal is open. Tap the golden button to enter now:`,
    cta: "✦ Access my portal",
    fallback: (url) =>
      `If the button expires, go to <a href="${url}" style="color:#c9a84c;">the login page</a> and request a new magic link with this same email.`,
  },
  es: {
    subject: "🔮 Tu acceso a ATB TAROT IA está listo",
    title: "Tu viaje ha comenzado",
    body: (n) =>
      `Hola, <strong style="color:#c9a84c;">${n}</strong>!<br>Tu compra fue confirmada y tu portal ya está abierto. Toca el botón dorado para entrar ahora:`,
    cta: "✦ Acceder a mi portal",
    fallback: (url) =>
      `Si el botón expira, ve a <a href="${url}" style="color:#c9a84c;">la página de inicio de sesión</a> y pide un nuevo enlace mágico con este mismo correo.`,
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

  // Magic link de acesso direto. redirectTo passa pelo callback de auth.
  let actionLink = `${opts.baseUrl}/login`;
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: opts.email,
      options: { redirectTo: `${opts.baseUrl}/api/auth/callback` },
    });
    if (!error && data?.properties?.action_link) {
      actionLink = data.properties.action_link;
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
      `Olá, <strong style="color:#c9a84c;">${n}</strong>!<br>A ATB preparou sua Limpeza Espiritual personalizada. Toque no botão para receber agora:`,
    cta: "✨ Abrir minha Limpeza",
    note: "Guarde este e-mail — o link é seu acesso permanente à sua limpeza.",
  },
  en: {
    subject: "🕊️ Your Spiritual Cleansing is ready",
    title: "Your Cleansing is ready",
    body: (n) =>
      `Hello, <strong style="color:#c9a84c;">${n}</strong>!<br>ATB has prepared your personalized Spiritual Cleansing. Tap the button to receive it now:`,
    cta: "✨ Open my Cleansing",
    note: "Keep this email — the link is your permanent access to your cleansing.",
  },
  es: {
    subject: "🕊️ Tu Limpieza Espiritual está lista",
    title: "Tu Limpieza está lista",
    body: (n) =>
      `Hola, <strong style="color:#c9a84c;">${n}</strong>!<br>ATB preparó tu Limpieza Espiritual personalizada. Toca el botón para recibirla ahora:`,
    cta: "✨ Abrir mi Limpieza",
    note: "Guarda este correo — el enlace es tu acceso permanente a tu limpieza.",
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
