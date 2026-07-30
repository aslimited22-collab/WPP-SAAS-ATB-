// ─── Google Ads (gtag.js) ─────────────────────────────────────────────────────
// Config centralizada do tag do Google Ads. Tudo vem de env vars porque o ID de
// conversão NÃO é o número da conta (681-163-7911): é um ID próprio no formato
// AW-XXXXXXXXXX que aparece em Google Ads → Objetivos → Conversões → a ação de
// conversão → "Instalar a tag manualmente". O rótulo (label) é a string depois
// da barra no send_to: "AW-123456789/AbC-D_efGh12".
//
//   NEXT_PUBLIC_GOOGLE_ADS_ID               → AW-XXXXXXXXXX
//   NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL → rótulo da conversão de compra
//
// Sem o ID configurado nada é carregado (nenhum script, nenhum evento) — assim
// um ID errado nunca fica hardcoded no repositório.

import { PRODUCT_PRICES, type Currency, type ProductId } from "@/lib/pricing";

export const GOOGLE_ADS_ID = (
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? ""
).trim();

export const GOOGLE_ADS_CONVERSION_LABEL = (
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL ?? ""
).trim();

/** O tag base só é injetado quando existe um ID de conversão válido. */
export function isAdsEnabled(): boolean {
  return /^AW-\d+$/.test(GOOGLE_ADS_ID);
}

/**
 * send_to da conversão de compra ("AW-XXXX/label"). Retorna null quando falta
 * o ID ou o rótulo — sem rótulo o Google Ads ignora o evento silenciosamente,
 * então é melhor não disparar nada do que disparar um evento inútil.
 */
export function purchaseSendTo(): string | null {
  if (!isAdsEnabled() || !GOOGLE_ADS_CONVERSION_LABEL) return null;
  return `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`;
}

// JPY não tem centavos: PRODUCT_PRICES guarda o valor inteiro direto.
// Nas outras moedas o valor está em centavos e precisa ser dividido por 100.
function toMajorUnits(amount: number, currency: Currency): number {
  return currency === "jpy" ? amount : amount / 100;
}

/**
 * Valor monetário da conversão a partir do produto + moeda que o checkout
 * propagou para /obrigado. Retorna null quando não dá para saber (ex.: a URL
 * de obrigado da Kiwify não traz ?plan=), e nesse caso a conversão é enviada
 * sem value — continua contando como conversão, só sem receita atribuída.
 */
export function conversionValue(
  plan: ProductId | null,
  currency: Currency | null
): { value: number; currency: string } | null {
  if (!plan || !currency) return null;
  const amount = PRODUCT_PRICES[plan]?.[currency];
  if (typeof amount !== "number") return null;
  return {
    value: toMajorUnits(amount, currency),
    currency: currency.toUpperCase(),
  };
}

export function isCurrency(s: string | undefined): s is Currency {
  return s === "brl" || s === "usd" || s === "eur" || s === "jpy";
}

// ─── Runtime (browser) ────────────────────────────────────────────────────────

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

/**
 * Garante que window.gtag existe ANTES de o gtag.js externo terminar de
 * carregar. É o mesmo stub do snippet oficial do Google: os eventos entram na
 * fila do dataLayer e são processados quando o script chega. Sem isto, um
 * evento disparado num useEffect que roda antes do <Script afterInteractive>
 * seria perdido.
 */
export function ensureGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments);
    };
  }
  return window.gtag;
}
