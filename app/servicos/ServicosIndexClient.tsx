"use client";

// Índice dos Trabalhos Espirituais — cards com preço (do banco) e link.
// Público 60+: fonte grande, contraste alto, alvos de toque generosos.

import Link from "next/link";
import { useUiLocale } from "@/lib/use-locale";
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
  services,
}: {
  services: SpiritualService[];
}) {
  const [locale] = useUiLocale();
  const t = SERVICOS_INDEX_CONTENT[locale];
  const content = SERVICOS_CONTENT[locale];

  return (
    <main className="min-h-screen bg-[#0a0a0a] stars-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="text-center mb-12">
          <p className="text-[#c9a84c] text-sm tracking-widest uppercase mb-4">
            {t.badge}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl gold-gradient-text font-bold mb-5">
            {t.titulo}
          </h1>
          <p className="text-[#c2b9a4] text-lg leading-relaxed max-w-2xl mx-auto">
            {t.subtitulo}
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
                href={`/servicos/${service.slug}`}
                className="mystic-card p-7 block transition-all hover:border-[#c9a84c]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c9a84c]"
              >
                <div className="text-4xl mb-4">{c.emoji}</div>
                <h2 className="font-serif text-2xl text-[#c9a84c] mb-2">
                  {service.nome}
                </h2>
                <p className="text-[#c2b9a4] text-base leading-relaxed mb-5">
                  {service.descricao_curta ?? c.subtitulo}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#e8e0d0] font-serif text-2xl font-bold">
                    {formatPrecoBRL(service.preco_centavos)}
                  </span>
                  <span className="btn-gold px-5 py-3 text-base whitespace-nowrap">
                    {t.verTrabalho} →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Disclaimers ──────────────────────────────────────────────── */}
        <footer className="border-t border-[#2a2a2a] pt-8 pb-12 text-center space-y-3">
          <p className="text-[#8a8272] text-sm leading-relaxed max-w-2xl mx-auto">
            {t.disclaimer}
          </p>
          <p className="text-[#8a8272] text-sm leading-relaxed max-w-2xl mx-auto">
            {t.arrependimento}
          </p>
        </footer>
      </div>
    </main>
  );
}
