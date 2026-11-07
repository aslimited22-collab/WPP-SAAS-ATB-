import type { AppLocale } from "./locale";
import type { Currency } from "./pricing";
import { SERVICE_SLUGS, type ServiceSlug } from "@/content/servicos";

export function isRitualSlug(value: unknown): value is ServiceSlug {
  return typeof value === "string" && SERVICE_SLUGS.some(slug => slug === value);
}

export function ritualPrice(slug: ServiceSlug, market: Currency, brazilCents: number) {
  if (market === "brl") return { currency: "brl" as const, cents: brazilCents };
  const xango = slug === "devocao-a-xango";
  if (market === "eur") return { currency: "eur" as const, cents: xango ? 3600 : 2700 };
  return { currency: "usd" as const, cents: xango ? 3900 : 2900 };
}

export function formatRitualPrice(slug: ServiceSlug, market: Currency, brazilCents: number, locale: AppLocale) {
  const { currency, cents } = ritualPrice(slug, market, brazilCents);
  return new Intl.NumberFormat(locale, {
    style: "currency", currency, currencyDisplay: currency === "brl" ? "symbol" : "code",
  }).format(cents / 100);
}
