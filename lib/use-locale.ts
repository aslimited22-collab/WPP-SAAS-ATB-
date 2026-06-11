"use client";

// ─── Idioma da interface (client-side) ────────────────────────────────────────
// Detecta o idioma do navegador na primeira visita e persiste a escolha
// manual em localStorage. Usado por todas as páginas client-side.

import { useEffect, useState, useCallback } from "react";

export type UiLocale = "pt-BR" | "en" | "es" | "de" | "it";

const STORAGE_KEY = "atb_locale";
const VALID_LOCALES: UiLocale[] = ["pt-BR", "en", "es", "de", "it"];

export function detectUiLocale(): UiLocale {
  if (typeof window === "undefined") return "pt-BR";
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

export function useUiLocale(): [UiLocale, (l: UiLocale) => void] {
  const [locale, setLocaleState] = useState<UiLocale>("pt-BR");

  useEffect(() => {
    const detected = detectUiLocale();
    setLocaleState(detected);
    document.documentElement.lang = detected;
  }, []);

  const setLocale = useCallback((l: UiLocale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // sem persistência — só muda a sessão atual
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
