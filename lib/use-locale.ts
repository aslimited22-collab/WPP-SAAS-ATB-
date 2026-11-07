"use client";

// ─── Idioma da interface (client-side) ────────────────────────────────────────
// Detecta o idioma do navegador na primeira visita e persiste a escolha
// manual em localStorage. Usado por todas as páginas client-side.

import { channelLocale } from "./locale";
import { useEffect, useState, useCallback } from "react";

export type UiLocale = "pt-BR" | "en" | "es" | "de" | "it";

const STORAGE_KEY = "atb_locale";
const VALID_LOCALES: UiLocale[] = ["pt-BR", "en", "es", "de", "it"];

export function detectUiLocale(): UiLocale {
  if (typeof window === "undefined") return "pt-BR";
  const linked = channelLocale(new URLSearchParams(window.location.search).get("lang"));
  if (linked) return linked;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (VALID_LOCALES.includes(saved as UiLocale)) return saved as UiLocale;
  } catch {
    // localStorage indisponível — segue para detecção
  }
  const lang = (navigator.language ?? "").toLowerCase();
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("es")) return "es";
  if (lang.startsWith("de")) return "de";
  if (lang.startsWith("it")) return "it";
  return "en";
}

function saveLocale(locale: UiLocale) {
  try {
    document.cookie = `atb_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch { /* Browser storage can be disabled. */ }
}

export function useUiLocale(initialLocale: UiLocale = "pt-BR"): [UiLocale, (l: UiLocale) => void] {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale);

  // Após a hidratação, aplica também as preferências salvas por versões anteriores.
  useEffect(() => {
    const detected = detectUiLocale();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(detected);
    document.documentElement.lang = detected;
    if (channelLocale(new URLSearchParams(location.search).get("lang"))) {
      saveLocale(detected);
    }
  }, []);

  const setLocale = useCallback((l: UiLocale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    saveLocale(l);
    const url = new URL(window.location.href);
    if (url.pathname === "/" || url.searchParams.has("lang")) {
      url.searchParams.set("lang", l);
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  return [locale, setLocale];
}

export const LOCALE_LABELS: Record<UiLocale, string> = {
  "pt-BR": "Português",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
};

// Sigla exibida nos botões do seletor de idioma.
export const LOCALE_SHORT: Record<UiLocale, string> = {
  "pt-BR": "PT",
  en: "EN",
  es: "ES",
  de: "DE",
  it: "IT",
};
