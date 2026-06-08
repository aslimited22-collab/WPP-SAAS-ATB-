import type { createServiceSupabaseClient } from "@/lib/supabase";

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

// ─── Planos / produtos ────────────────────────────────────────────────────────
// Cada produto vendido (Kiwify ou Stripe) mapeia para uma destas chaves.
// O valor armazenado em users.plan é apenas "basic" ou "premium"; produtos
// avulsos (pergunta3, limpeza) deixam o usuário no plano "basic" mas creditam
// leituras adicionais.
export type PlanKey = "basic" | "premium" | "pergunta3" | "limpeza";
export type UserPlan = "basic" | "premium";

export interface PlanConfig {
  // Valor gravado em users.plan
  userPlan: UserPlan;
  // Quantidade de leituras a creditar
  credits: number;
  // "set" substitui o saldo (assinaturas/renovações);
  // "add" soma ao saldo existente (compras avulsas).
  creditMode: "set" | "add";
}

export const PLAN_CONFIG: Record<PlanKey, PlanConfig> = {
  // R$29/mês — 5 leituras por mês
  basic: { userPlan: "basic", credits: 5, creditMode: "set" },
  // R$291,65 — leituras ilimitadas (representadas por 999)
  premium: { userPlan: "premium", credits: 999, creditMode: "set" },
  // R$19,90 — 3 perguntas avulsas (somadas ao saldo)
  pergunta3: { userPlan: "basic", credits: 3, creditMode: "add" },
  // R$100 — 1 leitura especial (somada ao saldo)
  limpeza: { userPlan: "basic", credits: 1, creditMode: "add" },
};

const PLAN_KEYS: PlanKey[] = ["basic", "premium", "pergunta3", "limpeza"];

// ─── Resolução de plano a partir do valor pago ────────────────────────────────
// Mapeia o valor (em CENTAVOS) para um plano. É a fonte da verdade quando não
// há mapeamento explícito por ID de produto/preço configurado via env.
export const AMOUNT_CENTS_TO_PLAN: Record<number, PlanKey> = {
  2900: "basic", // R$29,00
  29165: "premium", // R$291,65
  1990: "pergunta3", // R$19,90
  10000: "limpeza", // R$100,00
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
// Atualiza users.plan e atribui créditos conforme a configuração do plano.
// A tabela `subscriptions` NÃO é tocada aqui — suas colunas variam por provedor
// (Kiwify vs Stripe), então cada webhook faz o upsert da subscription.
export async function provisionPlan(
  supabase: ServiceClient,
  userId: string,
  planKey: PlanKey
): Promise<void> {
  const config = PLAN_CONFIG[planKey];
  const mesReferencia = new Date().toISOString().slice(0, 7);

  // 1. Atualizar o plano na tabela users.
  await supabase.from("users").update({ plan: config.userPlan }).eq("id", userId);

  // 2. Calcular o novo saldo de créditos.
  let leiturasRestantes = config.credits;
  if (config.creditMode === "add") {
    const { data: existing } = await supabase
      .from("credits")
      .select("leituras_restantes")
      .eq("user_id", userId)
      .maybeSingle();
    leiturasRestantes = (existing?.leituras_restantes ?? 0) + config.credits;
  }

  // 3. Gravar os créditos (upsert por user_id).
  await supabase.from("credits").upsert(
    {
      user_id: userId,
      leituras_restantes: leiturasRestantes,
      mes_referencia: mesReferencia,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
