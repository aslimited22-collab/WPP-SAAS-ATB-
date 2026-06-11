"use client";

// ─── Idioma da interface (client-side) ────────────────────────────────────────
// Detecta o idioma do navegador na primeira visita e persiste a escolha
// manual em localStorage. Usado por todas as páginas client-side.

import { useEffect, useState, useCallback } from "react";

export type UiLocale = "pt-BR" | "en" | "es";

const STORAGE_KEY = "atb_locale";

export function detectUiLocale(): UiLocale {
  if (typeof window === "undefined") return "pt-BR";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "pt-BR" || saved === "en" || saved === "es") return saved;
  } catch {
    // localStorage indisponível — segue para detecção
  }
  const lang = (navigator.language ?? "").toLowerCase();
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("es")) return "es";
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
};
