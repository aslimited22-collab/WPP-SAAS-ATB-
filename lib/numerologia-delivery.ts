// ─── Pipeline de entrega da Numerologia (R$45) — molde de lib/delivery.ts ────
// Chamado pelo POST /api/numerologia/dados (entrega na hora, depois do form)
// e reutilizável pelo admin. Idempotente: leitura já gerada não é regenerada.
//
// Passos: pedido pago + dados completos → geração (DeepSeek, idempotente via
// numerologia_readings) → PDF (pdf-lib) → e-mail com PDF ANEXO + link de
// download + BCC pro admin em TODA entrega → delivery_status/delivered_at.
//
// Fail-soft: falha de e-mail não explode a rota — fica delivery_status
// 'failed' + delivery_last_error pro admin reprocessar.

import type { createServiceSupabaseClient } from "@/lib/supabase";
import { sendEmail, mysticLayout, goldButton, escapeHtml } from "@/lib/email";
import {
  generateNumerologiaReading,
  type NumerologiaJson,
} from "@/lib/numerologia";
import { buildNumerologiaPdf } from "@/lib/numerologia-pdf";

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

// BCC de toda entrega. ADMIN_NOTIFY_EMAIL é o padrão do projeto pra
// notificações do dono; fallback no e-mail dele (não é segredo).
const BCC_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "aslimited22@gmail.com";

export interface NumerologiaDeliverResult {
  generation: "ok" | "cached" | "in_progress" | "failed";
  email: "sent" | "failed" | "skipped";
  finalDeliveryStatus: "pending" | "email_sent" | "failed";
  error?: string;
}

// Outro processo já reivindicou a geração deste pedido (claim via UNIQUE em
// numerologia_readings.order_id) — não é falha: quem pegou entrega.
export class NumerologiaInProgressError extends Error {
  constructor() {
    super("generation already in progress");
    this.name = "NumerologiaInProgressError";
  }
}

// Claim 'pending' mais velho que isso é de um processo morto (timeout da
// função serverless mata sem passar pelo catch) — pode ser retomado.
const STALE_PENDING_MS = 5 * 60 * 1000;

/**
 * Garante que a leitura existe em numerologia_readings (idempotente).
 * Retorna o JSON pronto ou lança em falha de geração.
 */
export async function ensureNumerologiaReading(
  supabase: ServiceClient,
  orderId: string,
  name: string,
  birthDate: string
): Promise<{ json: NumerologiaJson; cached: boolean }> {
  const { data: existing } = await supabase
    .from("numerologia_readings")
    .select("full_json, generation_status, updated_at")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing?.full_json && existing.generation_status === "completed") {
    return { json: existing.full_json as NumerologiaJson, cached: true };
  }

  // ── Claim anti-corrida (order_id é UNIQUE) ─────────────────────────────────
  // Dois POSTs simultâneos em /api/numerologia/dados gerariam duas leituras
  // DeepSeek e dois e-mails. Só um processo consegue criar/assumir a linha:
  // o perdedor recebe NumerologiaInProgressError e responde sem gerar nada.
  if (!existing) {
    const { error: claimErr } = await supabase
      .from("numerologia_readings")
      .insert({ order_id: orderId, generation_status: "pending" });
    if (claimErr) {
      if ((claimErr as { code?: string }).code === "23505") {
        throw new NumerologiaInProgressError();
      }
      throw new Error(`claim failed: ${claimErr.message}`);
    }
  } else {
    // Linha já existe sem leitura completa: 'error' (retry legítimo) ou
    // 'pending' (outro processo gerando — retomável só se for claim velho de
    // processo morto). O UPDATE condicional é atômico: o WHERE re-avalia sob
    // row lock, então só um concorrente leva.
    let claimQuery = supabase
      .from("numerologia_readings")
      .update({
        generation_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);
    if (existing.generation_status === "pending") {
      const staleBefore = new Date(Date.now() - STALE_PENDING_MS).toISOString();
      claimQuery = claimQuery
        .eq("generation_status", "pending")
        .lt("updated_at", staleBefore);
    } else {
      claimQuery = claimQuery.eq("generation_status", existing.generation_status);
    }
    const { data: claimed, error: claimErr } = await claimQuery.select("id");
    if (claimErr) {
      throw new Error(`claim failed: ${claimErr.message}`);
    }
    if (!claimed || claimed.length === 0) {
      throw new NumerologiaInProgressError();
    }
  }

  try {
    const { json, text } = await generateNumerologiaReading({ name, birthDate });

    await supabase.from("numerologia_readings").upsert(
      {
        order_id: orderId,
        full_json: json,
        full_text: text,
        generation_status: "completed",
        model_used: "deepseek",
        error_message: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_id" }
    );

    return { json, cached: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generation_failed";
    // Registra o erro pro admin enxergar; quem chama decide o status do pedido.
    await supabase.from("numerologia_readings").upsert(
      {
        order_id: orderId,
        generation_status: "error",
        error_message: msg.slice(0, 1000),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_id" }
    );
    throw err;
  }
}

/**
 * Entrega completa: geração + PDF + e-mail (anexo, BCC, link de download).
 */
export async function deliverNumerologiaOrder(
  supabase: ServiceClient,
  opts: { orderId: string; baseUrl: string }
): Promise<NumerologiaDeliverResult> {
  const { orderId, baseUrl } = opts;

  const { data: order } = await supabase
    .from("numerologia_orders")
    .select(
      "id, access_token, name, email, birth_date, status, delivery_attempts"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return {
      generation: "failed",
      email: "skipped",
      finalDeliveryStatus: "failed",
      error: "order not found",
    };
  }
  if (order.status !== "paid") {
    return {
      generation: "failed",
      email: "skipped",
      finalDeliveryStatus: "pending",
      error: "order not paid",
    };
  }
  if (!order.birth_date || !order.name) {
    // Cliente ainda não preencheu o form — não é erro, a entrega espera.
    return {
      generation: "failed",
      email: "skipped",
      finalDeliveryStatus: "pending",
      error: "missing customer data",
    };
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("numerologia_orders")
    .update({
      delivery_attempts: (order.delivery_attempts ?? 0) + 1,
      updated_at: nowIso,
    })
    .eq("id", order.id);

  // ── 1. Geração (idempotente) ───────────────────────────────────────────────
  let json: NumerologiaJson;
  let cached = false;
  try {
    const r = await ensureNumerologiaReading(
      supabase,
      order.id,
      order.name,
      String(order.birth_date)
    );
    json = r.json;
    cached = r.cached;
  } catch (err) {
    if (err instanceof NumerologiaInProgressError) {
      // Outro processo está gerando/entregando este pedido agora — não é
      // falha: não suja delivery_status nem dispara alarme.
      return {
        generation: "in_progress",
        email: "skipped",
        finalDeliveryStatus: "pending",
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Numerologia] Falha na geração:", msg);
    await supabase
      .from("numerologia_orders")
      .update({
        delivery_status: "failed",
        delivery_last_error: `generation: ${msg}`.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return {
      generation: "failed",
      email: "skipped",
      finalDeliveryStatus: "failed",
      error: msg,
    };
  }

  // ── 2. PDF ─────────────────────────────────────────────────────────────────
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildNumerologiaPdf(json, order.name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Numerologia] Falha ao montar o PDF:", msg);
    await supabase
      .from("numerologia_orders")
      .update({
        delivery_status: "failed",
        delivery_last_error: `pdf: ${msg}`.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return {
      generation: cached ? "cached" : "ok",
      email: "skipped",
      finalDeliveryStatus: "failed",
      error: msg,
    };
  }

  // ── 3. E-mail com anexo + BCC + botão de download ──────────────────────────
  // O nome vem da cliente (form público) e é interpolado no HTML do e-mail —
  // escapeHtml impede que "<img onerror=...>" no nome vire markup ativo.
  const firstName =
    escapeHtml((order.name ?? "").trim().split(/\s+/)[0]) || "querida alma";
  const downloadLink = `${baseUrl}/numerologia/download/${order.access_token}`;

  const html = mysticLayout(`
    <div style="font-size:56px;margin-bottom:14px;">🔢</div>
    <h1 style="color:#c9a84c;font-size:28px;margin:0 0 14px;">Seu mapa de Numerologia chegou, ${firstName} ✨</h1>
    <p style="font-size:17px;line-height:1.65;margin:0 0 20px;">Seu mapa numerológico pessoal — feito a partir do seu nome completo e da sua data de nascimento — está pronto, com carinho.</p>
    <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.4);border-radius:14px;padding:16px;margin:0 0 22px;">
      <div style="font-size:12px;color:#9a8f78;text-transform:uppercase;letter-spacing:0.1em;">Seus números da sorte</div>
      <div style="font-size:26px;color:#c9a84c;font-weight:bold;letter-spacing:0.15em;margin-top:6px;">${(json.numeros_da_sorte || []).join(" · ")}</div>
    </div>
    <p style="font-size:17px;line-height:1.65;margin:0 0 24px;">O mapa completo — com o significado de cada número e como usar cada um — está no <strong style="color:#c9a84c;">PDF anexo</strong> neste e-mail. Você também pode baixar quando quiser:</p>
    ${goldButton(downloadLink, "📥 Baixar meu mapa em PDF")}
    <p style="color:#9a8f78;font-size:13px;line-height:1.6;margin:26px 0 0;">O link fica disponível por 30 dias. Guarde o PDF com carinho. Este mapa é uma orientação espiritual e reflexiva — não substitui aconselhamento profissional.</p>
  `);

  const emailResult = await sendEmail({
    to: order.email,
    bcc: BCC_EMAIL,
    subject: `✨ ${firstName}, seu mapa de Numerologia da ATB chegou`,
    html,
    attachments: [
      {
        filename: "numerologia-atb.pdf",
        content: Buffer.from(pdfBytes).toString("base64"),
      },
    ],
  });

  if (emailResult.ok) {
    await supabase
      .from("numerologia_orders")
      .update({
        delivery_status: "email_sent",
        delivered_at: new Date().toISOString(),
        delivery_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return {
      generation: cached ? "cached" : "ok",
      email: "sent",
      finalDeliveryStatus: "email_sent",
    };
  }

  const reason = emailResult.reason ?? "email_failed";
  console.error("[Numerologia] Falha no e-mail de entrega:", reason);
  await supabase
    .from("numerologia_orders")
    .update({
      delivery_status: "failed",
      delivery_last_error: `email: ${reason}`.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  return {
    generation: cached ? "cached" : "ok",
    email: "failed",
    finalDeliveryStatus: "failed",
    error: reason,
  };
}
