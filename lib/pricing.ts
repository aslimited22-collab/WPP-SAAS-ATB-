// ─── Pricing centralizado por produto + moeda ─────────────────────────────────
// Usado pelo roteador /api/checkout/[plan] para criar Stripe Checkout Sessions
// com price_data inline (não exige cadastrar produtos no painel do Stripe).
// Valores em centavos; JPY não tem decimais (valor inteiro direto).
//
// Os MESMOS produtos existem na Kiwify (Brasil) — as URLs de checkout vêm de
// env vars NEXT_PUBLIC_KIWIFY_*_URL e o preço cobrado é o do produto na Kiwify.

import type { AppLocale } from "@/lib/locale";

export type ProductId =
  | "basic"
  | "premium"
  | "pergunta1"
  | "pergunta3"
  | "pergunta7"
  | "limpeza"
  | "numerologia";

export type Currency = "brl" | "usd" | "eur" | "jpy";
export type CheckoutMode = "subscription" | "payment";

export const PRODUCT_PRICES: Record<ProductId, Record<Currency, number>> = {
  basic: {
    brl: 2900, // R$29,00/mês
    usd: 900, // $9.00/month
    eur: 800, // €8,00/mês
    jpy: 900, // ¥900/月
  },
  premium: {
    brl: 29165, // R$291,65/mês
    usd: 5000, // $50.00/month
    eur: 4500, // €45,00/mês
    jpy: 7500, // ¥7,500/月
  },
  pergunta1: {
    brl: 1490, // R$14,90 — 1 pergunta no chat
    usd: 300, // $3.00
    eur: 280, // €2,80
    jpy: 450, // ¥450
  },
  pergunta3: {
    brl: 2900, // R$29,00 — 3 perguntas no chat
    usd: 600, // $6.00
    eur: 550, // €5,50
    jpy: 900, // ¥900
  },
  pergunta7: {
    brl: 3990, // R$39,90 — 7 perguntas no chat
    usd: 800, // $8.00
    eur: 750, // €7,50
    jpy: 1200, // ¥1,200
  },
  limpeza: {
    brl: 10000, // R$100,00 — Limpeza Espiritual personalizada
    usd: 1900, // $19.00
    eur: 1800, // €18,00
    jpy: 2900, // ¥2,900
  },
  numerologia: {
    brl: 4500, // R$45,00 — Mapa Numerológico completo em PDF
    usd: 4500, // $45.00
    eur: 4500, // €45,00
    jpy: 4500, // ¥4,500
  },
};

export const PRODUCT_TYPE: Record<ProductId, CheckoutMode> = {
  basic: "subscription",
  premium: "subscription",
  pergunta1: "payment",
  pergunta3: "payment",
  pergunta7: "payment",
  limpeza: "payment",
  numerologia: "payment",
};

// Produtos DESCONTINUADOS para novas vendas (03/08/2026): as assinaturas
// (basic/premium) e a compra de 1 pergunta saíram do catálogo.
// ATENÇÃO: os tipos e preços acima continuam existindo de propósito —
// há assinantes ATIVOS cujas RENOVAÇÕES seguem chegando pelo webhook e
// precisam ser provisionadas normalmente. O que muda é só a venda nova.
export const PRODUTOS_DESCONTINUADOS: ProductId[] = [
  "basic",
  "premium",
  "pergunta1",
];

export function isProdutoDescontinuado(s: string): boolean {
  return (PRODUTOS_DESCONTINUADOS as string[]).includes(s);
}

// Produto existe no catálogo? (inclui os descontinuados — usado por código
// que precisa reconhecer o produto, como o provisionamento de renovação.)
export function isValidProduct(s: string): s is ProductId {
  return (
    s === "basic" ||
    s === "premium" ||
    s === "pergunta1" ||
    s === "pergunta3" ||
    s === "pergunta7" ||
    s === "limpeza" ||
    s === "numerologia"
  );
}

// Produto pode ser COMPRADO agora? (usado pelo roteador de checkout)
export function isProdutoAVenda(s: string): s is ProductId {
  return isValidProduct(s) && !isProdutoDescontinuado(s);
}

// URL de checkout Kiwify por produto (branch Brasil do roteador).
export function kiwifyUrlFor(product: ProductId): string | undefined {
  const map: Record<ProductId, string | undefined> = {
    basic: process.env.NEXT_PUBLIC_KIWIFY_BASIC_URL,
    premium: process.env.NEXT_PUBLIC_KIWIFY_PREMIUM_URL,
    pergunta1: process.env.NEXT_PUBLIC_KIWIFY_PERGUNTA1_URL,
    pergunta3: process.env.NEXT_PUBLIC_KIWIFY_PERGUNTA3_URL,
    pergunta7: process.env.NEXT_PUBLIC_KIWIFY_PERGUNTA7_URL,
    limpeza: process.env.NEXT_PUBLIC_KIWIFY_LIMPEZA_URL,
    numerologia: process.env.NEXT_PUBLIC_KIWIFY_NUMEROLOGIA_URL,
  };
  return map[product];
}

// Nome exibido no Stripe Checkout, no idioma do comprador.
export function productDisplayName(product: ProductId, locale: AppLocale): string {
  const names: Record<AppLocale, Record<ProductId, string>> = {
    "pt-BR": {
      basic: "ATB TAROT — Plano Mensal",
      premium: "ATB TAROT — Premium",
      pergunta1: "ATB — 1 Pergunta Espiritual",
      pergunta3: "ATB — 3 Perguntas Espirituais",
      pergunta7: "ATB — 7 Perguntas Espirituais",
      limpeza: "ATB — Limpeza Espiritual Personalizada",
      numerologia: "ATB — Numerologia — Mapa Numerológico",
    },
    en: {
      basic: "ATB TAROT — Monthly Plan",
      premium: "ATB TAROT — Premium",
      pergunta1: "ATB — 1 Spiritual Question",
      pergunta3: "ATB — 3 Spiritual Questions",
      pergunta7: "ATB — 7 Spiritual Questions",
      limpeza: "ATB — Personalized Spiritual Cleansing",
      // Nome mantido em pt (produto BR-first; mesma grafia em todos os idiomas)
      numerologia: "ATB — Numerologia — Mapa Numerológico",
    },
    es: {
      basic: "ATB TAROT — Plan Mensual",
      premium: "ATB TAROT — Premium",
      pergunta1: "ATB — 1 Pregunta Espiritual",
      pergunta3: "ATB — 3 Preguntas Espirituales",
      pergunta7: "ATB — 7 Preguntas Espirituales",
      limpeza: "ATB — Limpieza Espiritual Personalizada",
      numerologia: "ATB — Numerologia — Mapa Numerológico",
    },
    de: {
      basic: "ATB TAROT — Monatsplan",
      premium: "ATB TAROT — Premium",
      pergunta1: "ATB — 1 Spirituelle Frage",
      pergunta3: "ATB — 3 Spirituelle Fragen",
      pergunta7: "ATB — 7 Spirituelle Fragen",
      limpeza: "ATB — Persönliche Spirituelle Reinigung",
      numerologia: "ATB — Numerologia — Mapa Numerológico",
    },
    it: {
      basic: "ATB TAROT — Piano Mensile",
      premium: "ATB TAROT — Premium",
      pergunta1: "ATB — 1 Domanda Spirituale",
      pergunta3: "ATB — 3 Domande Spirituali",
      pergunta7: "ATB — 7 Domande Spirituali",
      limpeza: "ATB — Pulizia Spirituale Personalizzata",
      numerologia: "ATB — Numerologia — Mapa Numerológico",
    },
  };
  return names[locale][product];
}

// Moeda + locale a partir do request (somente para o branch internacional).
// BR nunca chega aqui (vai para a Kiwify), mas se chegar a moeda BRL é
// detectada pelo roteador e força fallback para a Kiwify.
export function currencyForRequest(req: Request): {
  currency: Currency;
  locale: string;
} {
  const country = (req.headers.get("x-vercel-ip-country") ?? "").toUpperCase();
  const lang = (req.headers.get("accept-language") ?? "").toLowerCase();

  if (country === "BR" || lang.includes("pt-br")) {
    return { currency: "brl", locale: "pt-BR" };
  }

  if (country === "JP" || lang.startsWith("ja")) {
    return { currency: "jpy", locale: "ja" };
  }

  const EUROZONE_COUNTRIES = [
    "ES", "DE", "IT", "FR", "NL", "PT", "AT", "BE", "IE", "FI", "GR",
  ];
  const EUROZONE_LANGS = ["es", "de", "it", "fr", "nl", "pt-pt"];
  const isEurozone =
    EUROZONE_COUNTRIES.includes(country) ||
    EUROZONE_LANGS.some((l) => lang.startsWith(l));
  if (isEurozone) {
    let locale = "en";
    if (lang.startsWith("es")) locale = "es";
    else if (lang.startsWith("de")) locale = "de";
    else if (lang.startsWith("it")) locale = "it";
    else if (lang.startsWith("fr")) locale = "fr";
    // Lusófonos fora do Brasil (Portugal etc.): moeda EUR, idioma português.
    else if (lang.startsWith("pt")) locale = "pt-BR";
    return { currency: "eur", locale };
  }

  // Espanhol fora da zona do euro (México, Argentina, etc.) → USD em espanhol.
  if (lang.startsWith("es")) {
    return { currency: "usd", locale: "es" };
  }

  // Português fora do Brasil/eurozona (Angola, Moçambique...) → USD em PT.
  if (lang.startsWith("pt")) {
    return { currency: "usd", locale: "pt-BR" };
  }

  return { currency: "usd", locale: "en" };
}

// Locale aceito pelo Stripe Checkout (Stripe não aceita "pt", só "pt-BR").
export function stripeCheckoutLocale(locale: string): string {
  const lc = locale.toLowerCase();
  if (lc.startsWith("pt")) return "pt-BR";
  if (lc.startsWith("en")) return "en";
  if (lc.startsWith("es")) return "es";
  if (lc.startsWith("de")) return "de";
  if (lc.startsWith("it")) return "it";
  if (lc.startsWith("fr")) return "fr";
  if (lc.startsWith("nl")) return "nl";
  if (lc.startsWith("ja")) return "ja";
  return "auto";
}
