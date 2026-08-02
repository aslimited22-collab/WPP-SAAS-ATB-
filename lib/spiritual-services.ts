// ─── Trabalhos Espirituais: catálogo, pedidos e confirmação pós-compra ───────
// Modelo de entrega híbrida: compra → confirmação automática (WhatsApp +
// e-mail) com orientações de preparação → o OPERADOR realiza o ritual em até
// 48h úteis → entrega manual do registro pelo painel /admin/pedidos.
//
// Nada aqui afirma que um ritual foi realizado — isso só acontece quando o
// operador marca manualmente no painel.

import type { createServiceSupabaseClient } from "@/lib/supabase";
import { deepseekComplete } from "@/lib/deepseek";
import { sendWhatsApp } from "@/lib/zapi";
import { sendServicoConfirmacaoEmail } from "@/lib/email";
import {
  mensagemConfirmacao,
  mensagemOperadorNovoPedido,
} from "@/content/mensagens-servicos";

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

export interface SpiritualService {
  id: string;
  slug: string;
  nome: string;
  preco_centavos: number;
  descricao_curta: string | null;
  ativo: boolean;
  kiwify_product_id: string | null;
  kiwify_checkout_url: string | null;
  ordem: number;
}

export const SERVICE_ORDER_STATUSES = [
  "pago",
  "em_preparacao",
  "ritual_realizado",
  "entregue",
  "reembolsado",
] as const;
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

// Coluna de timestamp correspondente a cada transição de status.
export const STATUS_TIMESTAMP_COLUMN: Record<ServiceOrderStatus, string> = {
  pago: "pago_em",
  em_preparacao: "em_preparacao_em",
  ritual_realizado: "ritual_realizado_em",
  entregue: "entregue_em",
  reembolsado: "reembolsado_em",
};

// Mantém apenas dígitos — formato canônico de WhatsApp no banco.
export function soDigitos(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

// ─── Catálogo ────────────────────────────────────────────────────────────────

export async function listActiveServices(
  supabase: ServiceClient
): Promise<SpiritualService[]> {
  const { data } = await supabase
    .from("spiritual_services")
    .select(
      "id, slug, nome, preco_centavos, descricao_curta, ativo, kiwify_product_id, kiwify_checkout_url, ordem"
    )
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  return (data ?? []) as SpiritualService[];
}

export async function findServiceBySlug(
  supabase: ServiceClient,
  slug: string
): Promise<SpiritualService | null> {
  const { data } = await supabase
    .from("spiritual_services")
    .select(
      "id, slug, nome, preco_centavos, descricao_curta, ativo, kiwify_product_id, kiwify_checkout_url, ordem"
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as SpiritualService | null) ?? null;
}

export async function findServiceByKiwifyProductId(
  supabase: ServiceClient,
  productId: string | null
): Promise<SpiritualService | null> {
  if (!productId) return null;
  const { data } = await supabase
    .from("spiritual_services")
    .select(
      "id, slug, nome, preco_centavos, descricao_curta, ativo, kiwify_product_id, kiwify_checkout_url, ordem"
    )
    .eq("kiwify_product_id", productId)
    .maybeSingle();
  return (data as SpiritualService | null) ?? null;
}

// ─── Acolhimento personalizado (DeepSeek — opcional por pedido) ──────────────
// UM parágrafo de acolhimento, inserido no template fixo de confirmação.
// Regras rígidas (reforçadas no prompt E validadas na saída):
//   • é acolhimento + orientação de preparação, nada além;
//   • NUNCA afirma que o ritual já foi feito (ele SERÁ feito em até 48h úteis);
//   • NUNCA promete resultado.
// Fallback automático para o parágrafo estático se a API falhar, demorar
// mais de 5s ou a saída violar as regras.

const ACOLHIMENTO_TIMEOUT_MS = 5_000;

// Padrões proibidos na saída da IA (defesa em profundidade além do prompt).
const ACOLHIMENTO_PROIBIDO =
  /garantid|infal[ií]vel|100%|\bj[áa] (?:realizei|fiz|conclu)|ritual (?:foi|est[áa]) (?:feito|realizado|pronto)|vai voltar|vit[óo]ria no processo|vai ganhar|dinheiro certo|emprego certo/i;

export async function gerarAcolhimento(opts: {
  nome: string | null | undefined;
  servicoNome: string;
}): Promise<string | null> {
  const nome = (opts.nome ?? "").trim().split(/\s+/)[0] || "querida alma";

  const prompt = `Escreva UM único parágrafo curto (no máximo 3 frases, sem quebras de linha) de acolhimento para ${nome}, que acabou de comprar o trabalho espiritual "${opts.servicoNome}".

REGRAS OBRIGATÓRIAS:
- Tom: acolhedor, caloroso, espiritual, em português brasileiro coloquial.
- Diga que o pedido foi recebido com carinho e que o ritual dela SERÁ preparado e realizado pessoalmente em até 48 horas úteis. Use o futuro — o ritual AINDA NÃO foi feito.
- NUNCA afirme que o ritual já foi realizado, iniciado ou está pronto.
- NUNCA prometa nenhum resultado (nada de dinheiro, amor de pessoa específica, vitória, cura, "vai dar certo"). Fale de fé, intenção, cuidado e acolhimento.
- Sem markdown, sem asteriscos, sem emojis, sem listas. Texto puro.`;

  try {
    const result = await Promise.race([
      deepseekComplete([{ role: "user", content: prompt }], {
        temperature: 1.0,
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), ACOLHIMENTO_TIMEOUT_MS)
      ),
    ]);

    if (!result) return null;

    // Sanitização: remove markdown/quebras, limita tamanho.
    const clean = result
      .replace(/[*_#`>|]/g, "")
      .replace(/\s*\n+\s*/g, " ")
      .trim()
      .slice(0, 500);

    if (clean.length < 30) return null;
    if (ACOLHIMENTO_PROIBIDO.test(clean)) {
      console.warn("[Servicos] Acolhimento da IA violou regras — usando fallback");
      return null;
    }
    return clean;
  } catch {
    return null;
  }
}

// ─── Notificação do operador via WhatsApp ────────────────────────────────────
// OPERATOR_WHATSAPP: número (só dígitos, com país) que recebe os avisos
// operacionais. Sem a env, a notificação é silenciosamente pulada.
export async function notifyOperator(text: string): Promise<boolean> {
  const operator = soDigitos(process.env.OPERATOR_WHATSAPP);
  if (!operator) return false;
  try {
    const r = await sendWhatsApp(operator, text, { humanTyping: false });
    return r.success;
  } catch {
    return false;
  }
}

// ─── Compra aprovada: criar pedido + confirmação + avisos ────────────────────
// Idempotente: a UNIQUE em kiwify_order_id descarta duplicatas (além do
// marcador de idempotência do próprio webhook).
export async function processarCompraServico(
  supabase: ServiceClient,
  opts: {
    service: SpiritualService;
    kiwifyOrderId: string;
    email: string;
    nome: string | null;
    phone: string | null;
    amountCents: number | null;
    baseUrl: string;
  }
): Promise<{ ok: boolean; orderId?: string; duplicate?: boolean }> {
  const whatsapp = soDigitos(opts.phone);
  const nowIso = new Date().toISOString();

  // upsert com ignoreDuplicates: pedido já existente (reentrega do webhook)
  // não é recriado nem re-notificado.
  const { data: inserted, error } = await supabase
    .from("service_orders")
    .upsert(
      {
        service_id: opts.service.id,
        cliente_nome: opts.nome,
        cliente_email: opts.email,
        cliente_whatsapp: whatsapp || null,
        status: "pago",
        kiwify_order_id: opts.kiwifyOrderId,
        amount_cents: opts.amountCents,
        locale: "pt-BR",
        pago_em: nowIso,
      },
      { onConflict: "kiwify_order_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error("[Servicos] Falha ao criar service_order:", error.message);
    return { ok: false };
  }
  if (!inserted || inserted.length === 0) {
    // Conflito em kiwify_order_id — pedido já processado antes.
    return { ok: true, duplicate: true };
  }
  const orderId = inserted[0].id as string;

  // ── Mensagem de confirmação (WhatsApp) com acolhimento da IA ──────────────
  const acolhimento = await gerarAcolhimento({
    nome: opts.nome,
    servicoNome: opts.service.nome,
  });
  const texto = mensagemConfirmacao({
    nome: opts.nome,
    servicoNome: opts.service.nome,
    servicoSlug: opts.service.slug,
    acolhimento,
  });

  let waOk = false;
  if (whatsapp) {
    try {
      const r = await sendWhatsApp(whatsapp, texto, { humanTyping: false });
      waOk = r.success;
    } catch {
      waOk = false;
    }
  }

  // ── E-mail equivalente (fail-soft) ────────────────────────────────────────
  const emailResult = await sendServicoConfirmacaoEmail({
    email: opts.email,
    nome: opts.nome,
    servicoNome: opts.service.nome,
    temWhatsapp: Boolean(whatsapp),
  });

  await supabase
    .from("service_orders")
    .update({
      confirmacao_whatsapp_ok: whatsapp ? waOk : null,
      confirmacao_email_ok: emailResult.ok,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  // ── Aviso ao operador ─────────────────────────────────────────────────────
  await notifyOperator(
    mensagemOperadorNovoPedido({
      servicoNome: opts.service.nome,
      clienteNome: opts.nome,
      clienteEmail: opts.email,
      clienteWhatsapp: whatsapp,
      kiwifyOrderId: opts.kiwifyOrderId,
      adminUrl: `${opts.baseUrl}/admin/pedidos/${orderId}`,
    })
  );

  return { ok: true, orderId };
}
