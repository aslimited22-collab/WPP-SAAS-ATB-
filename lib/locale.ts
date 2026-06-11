// ─── Idioma do comprador ──────────────────────────────────────────────────────
// Idiomas com tradução própria (e-mails, funil da limpeza, respostas da IA).
// Outros idiomas caem em "en". O locale do usuário é gravado em users.locale
// no momento da compra (Stripe session.locale / Kiwify → pt-BR) e usado em
// toda comunicação posterior.

export type AppLocale = "pt-BR" | "en" | "es" | "de" | "it";

export const APP_LOCALES: AppLocale[] = ["pt-BR", "en", "es", "de", "it"];

// Nome do idioma por extenso — usado nos prompts de IA ("responda em …").
export const LOCALE_LANGUAGE_NAME: Record<AppLocale, string> = {
  "pt-BR": "português brasileiro",
  en: "English",
  es: "español",
  de: "Deutsch (alemão)",
  it: "italiano",
};

// Normaliza qualquer tag de idioma (pt, pt-BR, es-MX, en-US, de, it…)
// para um AppLocale. Vazio/nulo → pt-BR (mercado principal).
export function normalizeLocale(raw: string | null | undefined): AppLocale {
  const lc = (raw ?? "").trim().toLowerCase();
  if (!lc) return "pt-BR";
  if (lc.startsWith("pt")) return "pt-BR";
  if (lc.startsWith("es")) return "es";
  if (lc.startsWith("de")) return "de";
  if (lc.startsWith("it")) return "it";
  return "en";
}

// País do visitante a partir dos headers de edge (Vercel/Cloudflare).
// Retorna código ISO de 2 letras em maiúsculas, ou "" se indisponível.
export function detectCountry(req: Request): string {
  return (
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    ""
  ).toUpperCase();
}

// Brasil → Kiwify; resto do mundo → Stripe.
// Sem header de país (dev local), cai no Accept-Language.
export function isBrazilRequest(req: Request): boolean {
  const country = detectCountry(req);
  if (country) return country === "BR";
  const lang = (req.headers.get("accept-language") ?? "").toLowerCase();
  return lang.includes("pt-br") || lang.startsWith("pt");
}

// Locale preferido do visitante a partir do Accept-Language.
export function detectRequestLocale(req: Request): AppLocale {
  const lang = (req.headers.get("accept-language") ?? "").split(",")[0];
  return normalizeLocale(lang);
}
