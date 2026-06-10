// ─── Pipeline de entrega da Limpeza Espiritual ────────────────────────────────
// Chamado pelos webhooks (Kiwify/Stripe) após confirmação de pagamento e pela
// rota interna de reentrega. Idempotente: leitura já gerada não é regenerada;
// cada passo é fail-soft e o melhor estado alcançado fica em delivery_status.

import type { createServiceSupabaseClient } from "@/lib/supabase";
import { normalizeLocale, type AppLocale } from "@/lib/locale";
import {
  generateLimpezaReading,
  type LimpezaTheme,
  type LimpezaSign,
} from "@/lib/limpeza";
import { sendLimpezaEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/zapi";

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

export interface DeliverResult {
  generation: { ok: boolean; reason?: string };
  email: { ok: boolean; reason?: string };
  whatsapp: { ok: boolean; reason?: string };
  finalDeliveryStatus:
    | "email_sent"
    | "whatsapp_sent"
    | "both_sent"
    | "failed";
}

const WHATSAPP_COPY: Record<AppLocale, (nome: string, link: string) => string> = {
  "pt-BR": (nome, link) =>
    `Olá, ${nome}! Aqui é do ATB TAROT IA. 🕊️ Sua Limpeza Espiritual personalizada está pronta. Acesse agora: ${link}`,
  en: (nome, link) =>
    `Hello, ${nome}! This is ATB TAROT AI. 🕊️ Your personalized Spiritual Cleansing is ready. Access it now: ${link}`,
  es: (nome, link) =>
    `Hola, ${nome}! Somos ATB TAROT IA. 🕊️ Tu Limpieza Espiritual personalizada está lista. Accede ahora: ${link}`,
};

export async function deliverLimpezaOrder(
  supabase: ServiceClient,
  opts: { orderId: string; baseUrl: string }
): Promise<DeliverResult | null> {
  const { orderId, baseUrl } = opts;

  const { data: order } = await supabase
    .from("limpeza_orders")
    .select(
      "id, nome, email, phone, signo, tema, pergunta, locale, status, delivery_attempts"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    console.error("[Delivery] Pedido de limpeza não encontrado:", orderId);
    return null;
  }

  const locale = normalizeLocale(order.locale);
  const deliveryLink = `${baseUrl}/entrega/${order.id}`;
  const nowIso = new Date().toISOString();

  await supabase
    .from("limpeza_orders")
    .update({
      delivery_attempts: (order.delivery_attempts ?? 0) + 1,
      delivery_last_attempt_at: nowIso,
    })
    .eq("id", order.id);

  // ── 1. Geração (idempotente: não regenera se já existir) ──────────────────
  let generation: DeliverResult["generation"] = { ok: false };
  try {
    const { data: existing } = await supabase
      .from("limpeza_readings")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle();

    if (existing) {
      generation = { ok: true, reason: "already_generated" };
    } else {
      const reading = await generateLimpezaReading({
        nome: order.nome ?? "",
        tema: (order.tema ?? "protecao_espiritual") as LimpezaTheme,
        signo: (order.signo as LimpezaSign | null) ?? null,
        pergunta: order.pergunta ?? "",
        locale,
      });
      const { error: insErr } = await supabase.from("limpeza_readings").insert({
        order_id: order.id,
        full_json: reading.json,
        full_text: reading.text,
      });
      generation = insErr
        ? { ok: false, reason: `insert: ${insErr.message}` }
        : { ok: true };
    }
  } catch (err) {
    generation = {
      ok: false,
      reason: err instanceof Error ? err.message : "generation_failed",
    };
    console.error("[Delivery] Falha na geração da limpeza:", generation.reason);
  }

  // ── 2. E-mail — SÓ depois da leitura existir ───────────────────────────────
  // Sem leitura gerada não enviamos "está pronta": o pedido fica com
  // delivery_status='failed' e o reprocessamento (/api/limpeza/generate)
  // tenta de novo gerar E entregar.
  let email: DeliverResult["email"] = { ok: false, reason: "generation_failed" };
  if (generation.ok) {
    email = await sendLimpezaEmail({
      email: order.email,
      nome: order.nome,
      locale,
      deliveryLink,
    });
  }

  // ── 3. WhatsApp (se houver telefone) ───────────────────────────────────────
  let whatsapp: DeliverResult["whatsapp"] = { ok: false, reason: "no_phone" };
  if (generation.ok && order.phone) {
    try {
      const firstName =
        (order.nome ?? "").trim().split(/\s+/)[0] ||
        (locale === "en" ? "dear soul" : "querida alma");
      const r = await sendWhatsApp(
        order.phone,
        WHATSAPP_COPY[locale](firstName, deliveryLink)
      );
      whatsapp = { ok: r.success, reason: r.error };
    } catch {
      whatsapp = { ok: false, reason: "zapi_exception" };
    }
  }

  // ── 4. Status final ─────────────────────────────────────────────────────────
  // Geração falha = entrega falha (mesmo que algum canal tivesse saído):
  // pedidos quebrados ficam visíveis para reprocessamento.
  let finalDeliveryStatus: DeliverResult["finalDeliveryStatus"] = "failed";
  if (generation.ok) {
    if (email.ok && whatsapp.ok) finalDeliveryStatus = "both_sent";
    else if (email.ok) finalDeliveryStatus = "email_sent";
    else if (whatsapp.ok) finalDeliveryStatus = "whatsapp_sent";
  }

  const errors: string[] = [];
  if (!generation.ok) errors.push(`gen:${generation.reason}`);
  if (!email.ok) errors.push(`email:${email.reason}`);
  if (!whatsapp.ok && whatsapp.reason !== "no_phone") {
    errors.push(`wa:${whatsapp.reason}`);
  }

  const patch: Record<string, unknown> = {
    delivery_status: finalDeliveryStatus,
    delivery_last_error: errors.length ? errors.join(" | ").slice(0, 500) : null,
  };
  if (email.ok) patch.delivery_email_sent_at = nowIso;
  if (whatsapp.ok) patch.delivery_whatsapp_sent_at = nowIso;

  await supabase.from("limpeza_orders").update(patch).eq("id", order.id);

  return { generation, email, whatsapp, finalDeliveryStatus };
}
