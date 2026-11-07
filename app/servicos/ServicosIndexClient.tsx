"use client";

// Índice dos Trabalhos Espirituais — cards com preço (do banco) e link.
// Público 60+: fonte grande, contraste alto, alvos de toque generosos.

import { StoreHeader } from "@/app/components/StoreHeader";
import { storefront } from "@/content/storefront";
import { rituals } from "@/content/rituals";
import Link from "next/link";
import { useUiLocale, type UiLocale } from "@/lib/use-locale";
import {
  SERVICOS_CONTENT,
  SERVICOS_INDEX_CONTENT,
  type ServiceSlug,
} from "@/content/servicos";
import type { SpiritualService } from "@/lib/spiritual-services";

function formatPrecoBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

export default function ServicosIndexClient({
  services, initialLocale,
}: {
  initialLocale: UiLocale;
  services: SpiritualService[];
}) {
  const [locale, setLocale] = useUiLocale(initialLocale);
  const t = SERVICOS_INDEX_CONTENT["pt-BR"];
  const copy = storefront[locale];
  const r = rituals[locale];
  const content = SERVICOS_CONTENT[locale];

  return (
    <div className="atb-shop atb-funnel" lang={locale}><StoreHeader locale={locale} onLocale={setLocale} /><main className="atb-services">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="text-center mb-12">
          <h1 className="font-serif text-4xl sm:text-5xl gold-gradient-text font-bold mb-5">
            {copy.rituals}
          </h1>
          <p className="text-[#c2b9a4] text-lg leading-relaxed max-w-2xl mx-auto">
            {locale === "pt-BR" ? t.subtitulo : r.instructions}
          </p>
        </header>

        {/* ── Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {services.map((service) => {
            const c = content[service.slug as ServiceSlug];
            if (!c) return null;
            return (
              <Link
                key={service.id}
                href={`/servicos/${service.slug}?lang=${locale}`}
                className="mystic-card p-7 block transition-all hover:border-[#c9a84c]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c9a84c]"
              >
                <span className="atb-service-star" aria-hidden="true">✦</span>
                <h2 className="font-serif text-2xl text-[#c9a84c] mb-2">
                  {r.services[service.slug as ServiceSlug].title}
                </h2>
                <p className="text-[#c2b9a4] text-base leading-relaxed mb-5">
                  {locale === "pt-BR" ? service.descricao_curta ?? c.subtitulo : r.services[service.slug as ServiceSlug].description}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[#e8e0d0] font-serif text-2xl font-bold">
                    {formatPrecoBRL(service.preco_centavos)}
                  </span>
                  <span className="btn-gold px-5 py-3 text-base whitespace-nowrap">
                    {copy.view} →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Disclaimers ──────────────────────────────────────────────── */}
        <footer className="border-t border-[#2a2a2a] pt-8 pb-12 text-center space-y-3">
          <p className="text-[#8a8272] text-sm leading-relaxed max-w-2xl mx-auto">
            {locale === "pt-BR" ? t.disclaimer : copy.notice}
          </p>
          <p className="text-[#8a8272] text-sm leading-relaxed max-w-2xl mx-auto">
            {r.refund}
          </p>
        </footer>
      </div>
    </main></div>
  );
}
