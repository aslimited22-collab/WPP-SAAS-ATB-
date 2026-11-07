"use client";

import Link from "next/link";
import { storefront } from "@/content/storefront";
import { LOCALE_LABELS, LOCALE_SHORT, type UiLocale } from "@/lib/use-locale";

export function Brand() {
  return <Link className="atb-brand" href="/" aria-label="ATB Tarot">
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="currentColor" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => <path key={i} d={i % 2 ? "M20 6v3" : "M20 2v7"} transform={`rotate(${i * 22.5} 20 20)`} />)}
      <circle cx="20" cy="20" r="9" /><path d="M21 13a7 7 0 0 0 3 11 7 7 0 0 1-3-11Z" fill="currentColor" stroke="none" />
    </svg>
    ATB <span>Tarot</span>
  </Link>;
}

export function StoreHeader({ locale, onLocale }: { locale: UiLocale; onLocale: (l: UiLocale) => void }) {
  const t = storefront[locale];
  return <header className="atb-header"><div className="atb-wrap atb-nav">
    <Brand />
    <nav className="atb-menu"><a href="/#produtos">{t.nav}</a><a href="/#como-funciona">{t.how}</a></nav>
    <div className="atb-tools">
      <label className="atb-language">
        <span aria-hidden="true">{LOCALE_SHORT[locale]} ⌄</span>
        <select aria-label={t.language} value={locale} onChange={e => onLocale(e.target.value as UiLocale)}>
          {(Object.keys(LOCALE_LABELS) as UiLocale[]).map(key => <option key={key} value={key} lang={key}>{LOCALE_LABELS[key]}</option>)}
        </select>
      </label>
      <Link className="atb-portal" href={`/login?lang=${locale}`}>{t.portal}<span aria-hidden="true"> ↗</span></Link>
    </div>
  </div></header>;
}
