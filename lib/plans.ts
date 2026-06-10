import type { createServiceSupabaseClient } from "@/lib/supabase";
import type { AppLocale } from "@/lib/locale";

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

// ─── Planos / produtos ────────────────────────────────────────────────────────
// Cada produto vendido (Kiwify ou Stripe) mapeia para uma destas chaves.
//
//   basic     → assinatura mensal: 5 leituras WhatsApp/mês + 30 msgs de chat/mês
//   premium   → assinatura: leituras ilimitadas (999) + 100 msgs de chat/mês
//   pergunta1/3/7 → compras avulsas de CRÉDITOS DE CHAT (+1/+3/+7 perguntas
//                   para conversar com a ATB no chat — produto DeepSeek)
//   limpeza   → Limpeza Espiritual personalizada, entregue via funil /limpeza
//               (geração OpenAI + e-mail + página /entrega/[orderId])
//
// Compras avulsas (pergunta*/limpeza) NÃO criam assinatura nem alteram o plano:
// o acesso delas é por crédito de chat ou pela página de entrega.
export type PlanKey =
  | "basic"
  | "premium"
  | "pergunta1"
  | "pergunta3"
  | "pergunta7"
  | "limpeza";
export type UserPlan = "basic" | "premium";

export interface PlanConfig {
  // Valor gravado em users.plan (null = não altera o plano do usuário)
  userPlan: UserPlan | null;
  // Assinatura: cria/atualiza registro em subscriptions
  isSubscription: boolean;
  // Leituras de tarot via WhatsApp a creditar
  readingCredits: number;
  // "set" substitui o saldo (assinaturas/renovações); "add" soma (avulsos)
  readingCreditMode: "set" | "add";
  // Créditos de chat avulsos a SOMAR em users.chat_credits_balance
  chatCredits: number;
}

export const PLAN_CONFIG: Record<PlanKey, PlanConfig> = {
  basic: {
    userPlan: "basic",
    isSubscription: true,
    readingCredits: 5,
    readingCreditMode: "set",
    chatCredits: 0,
  },
  premium: {
    userPlan: "premium",
    isSubscription: true,
    readingCredits: 999,
    readingCreditMode: "set",
    chatCredits: 0,
  },
  pergunta1: {
    userPlan: null,
    isSubscription: false,
    readingCredits: 0,
    readingCreditMode: "add",
    chatCredits: 1,
  },
  pergunta3: {
    userPlan: null,
    isSubscription: false,
    readingCredits: 0,
    readingCreditMode: "add",
    chatCredits: 3,
  },
  pergunta7: {
    userPlan: null,
    isSubscription: false,
    readingCredits: 0,
    readingCreditMode: "add",
    chatCredits: 7,
  },
  // A limpeza é entregue pelo funil (orders/readings próprios) — não credita
  // leituras nem chat; o webhook dispara o pipeline de entrega.
  limpeza: {
    userPlan: null,
    isSubscription: false,
    readingCredits: 0,
    readingCreditMode: "add",
    chatCredits: 0,
  },
};

const PLAN_KEYS: PlanKey[] = [
  "basic",
  "premium",
  "pergunta1",
  "pergunta3",
  "pergunta7",
  "limpeza",
];

// ─── Chat com a ATB (DeepSeek) ────────────────────────────────────────────────
// Cota mensal de mensagens por plano de assinatura. Créditos avulsos
// (chat_credits_balance) têm prioridade e ignoram a cota.
export const MESSAGE_LIMITS_MONTH: Record<UserPlan, number> = {
  basic: 30,
  premium: 100,
};

// Intervalo mínimo entre mensagens (anti-flood / contenção de custo)
export const THROTTLE_SECONDS: Record<UserPlan | "free", number> = {
  free: 10,
  basic: 5,
  premium: 2,
};

// Chave do mês corrente (ex.: "2026-06") para cota mensal de chat e créditos.
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

// ─── Resolução de plano a partir do valor pago ────────────────────────────────
// Fallback usado SOMENTE pelo webhook Kiwify (valores em centavos de REAL).
// O webhook Stripe resolve o produto por metadata.plan (gravado pelo roteador
// de checkout) — nunca por valor, pois moedas diferentes colidiriam.
export const AMOUNT_CENTS_TO_PLAN: Record<number, PlanKey> = {
  2900: "basic", // R$29,00
  25000: "premium", // R$250,00
  29165: "premium", // R$291,65 (preço legado)
  1490: "pergunta1", // R$14,90
  1990: "pergunta3", // R$19,90
  3990: "pergunta7", // R$39,90
  10000: "limpeza", // R$100,00
  9700: "limpeza", // R$97,00 (preço alternativo)
};

// Normaliza um valor que pode vir como número ou string (ex.: "2900", "29.00").
// Retorna o valor em centavos como inteiro, ou null se não for parseável.
export function toCents(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  // "2900" → 2900 centavos; "29.00"/"29,00" → 2900 centavos.
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  const normalized = trimmed.replace(",", ".");
  const asFloat = Number(normalized);
  if (!Number.isFinite(asFloat)) return null;
  return Math.round(asFloat * 100);
}

export function resolvePlanFromAmount(
  amountCents: number | null | undefined
): PlanKey | null {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) {
    return null;
  }
  return AMOUNT_CENTS_TO_PLAN[amountCents] ?? null;
}

// Resolve a partir de um identificador externo (product_id da Kiwify ou
// price/product id do Stripe), comparando com variáveis de ambiente do formato
// `${envPrefix}_BASIC`, `${envPrefix}_PREMIUM`, etc. Ex.: envPrefix "KIWIFY_PRODUCT"
// → KIWIFY_PRODUCT_BASIC, KIWIFY_PRODUCT_PREMIUM, ...
export function resolvePlanFromEnv(
  externalId: string | null | undefined,
  envPrefix: string
): PlanKey | null {
  if (!externalId) return null;
  for (const key of PLAN_KEYS) {
    const envVal = process.env[`${envPrefix}_${key.toUpperCase()}`];
    if (envVal && envVal === externalId) return key;
  }
  return null;
}

// ─── Provisionamento de plano e créditos ──────────────────────────────────────
// Atualiza users.plan, credita leituras e créditos de chat, e grava o locale
// do comprador. A tabela `subscriptions` NÃO é tocada aqui — suas colunas
// variam por provedor (Kiwify vs Stripe), então cada webhook faz o upsert.
//
// Retorna { ok, errors } — quem chama decide logar/retornar 500 para o
// gateway retentar (as operações são idempotentes do lado do banco).
export async function provisionPlan(
  supabase: ServiceClient,
  userId: string,
  planKey: PlanKey,
  options?: { locale?: AppLocale }
): Promise<{ ok: boolean; errors: string[] }> {
  const config = PLAN_CONFIG[planKey];
  const mesReferencia = currentMonthKey();
  const errors: string[] = [];

  // 1. Atualizar plano e locale na tabela users.
  const userPatch: Record<string, unknown> = {};
  if (config.userPlan) userPatch.plan = config.userPlan;
  if (options?.locale) userPatch.locale = options.locale;
  if (Object.keys(userPatch).length > 0) {
    const { error } = await supabase
      .from("users")
      .update(userPatch)
      .eq("id", userId);
    if (error) errors.push(`users.update: ${error.message}`);
  }

  // 2. Créditos de leitura (tarot via WhatsApp).
  if (config.readingCredits > 0) {
    let leiturasRestantes = config.readingCredits;
    if (config.readingCreditMode === "add") {
      const { data: existing } = await supabase
        .from("credits")
        .select("leituras_restantes")
        .eq("user_id", userId)
        .maybeSingle();
      leiturasRestantes =
        (existing?.leituras_restantes ?? 0) + config.readingCredits;
    }

    const { error } = await supabase.from("credits").upsert(
      {
        user_id: userId,
        leituras_restantes: leiturasRestantes,
        mes_referencia: mesReferencia,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) errors.push(`credits.upsert: ${error.message}`);
  }

  // 3. Créditos de chat (perguntas avulsas) — incremento ATÔMICO no banco
  // (RPC grant_chat_credits), imune a race com o consumo do chat.
  if (config.chatCredits > 0) {
    const { error } = await supabase.rpc("grant_chat_credits", {
      p_user_id: userId,
      p_amount: config.chatCredits,
    });
    if (error) errors.push(`grant_chat_credits: ${error.message}`);
  }

  return { ok: errors.length === 0, errors };
}
