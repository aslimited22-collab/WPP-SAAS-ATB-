"use client";

// Landing de um Trabalho Espiritual — hero, como funciona (3 passos),
// o que você recebe, FAQ e disclaimers. CTA → checkout Kiwify (URL do banco).
// Público 60+: fonte grande, contraste alto, botões 56px+, foco visível.

import Link from "next/link";
import { useUiLocale } from "@/lib/use-locale";
import {
  SERVICOS_CONTENT,
  SERVICOS_LABELS,
  type ServiceSlug,
} from "@/content/servicos";

interface ServiceProps {
  slug: string;
  nome: string;
  preco_centavos: number;
  kiwify_checkout_url: string | null;
}

function formatPrecoBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

export default function ServicoLandingClient({
  service,
}: {
  service: ServiceProps;
}) {
  const [locale] = useUiLocale();
  const c = SERVICOS_CONTENT[locale][service.slug as ServiceSlug];
  const labels = SERVICOS_LABELS[locale];
  const preco = formatPrecoBRL(service.preco_centavos);
  const checkoutUrl = service.kiwify_checkout_url;

  return (
    <main className="min-h-screen bg-[#0a0a0a] stars-bg">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* ── Voltar ───────────────────────────────────────────────────── */}
        <nav className="mb-8">
          <Link
            href="/servicos"
            className="text-[#9a8f78] hover:text-[#c9a84c] text-base transition-colors"
          >
            {labels.voltarTrabalhos}
          </Link>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="text-center mb-12">
          <div className="text-6xl mb-5 animate-float">{c.emoji}</div>
          <p className="text-[#c9a84c] text-sm tracking-widest uppercase mb-4">
            {c.badge}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl gold-gradient-text font-bold mb-5">
            {c.titulo}
          </h1>
          <p className="text-[#c2b9a4] text-lg leading-relaxed max-w-xl mx-auto mb-8">
            {c.subtitulo}
          </p>

          <div className="mystic-card inline-block px-8 py-6">
            <div className="font-serif text-4xl gold-gradient-text font-bold mb-1">
              {preco}
            </div>
            <div className="text-[#9a8f78] text-sm mb-5">{labels.precoUnico}</div>
            {checkoutUrl ? (
              <a
                href={checkoutUrl}
                className="btn-gold block w-full px-10 py-5 text-lg text-center"
              >
                {c.cta}
              </a>
            ) : (
              <p className="text-[#9a8f78] text-base border border-[#2a2a2a] rounded-lg px-6 py-4">
                {labels.emBreve}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-5 text-[#9a8f78] text-sm">
              <span>🕯️ {labels.entregaRapida}</span>
              <span>🤫 {labels.sigilo}</span>
            </div>
          </div>
        </header>

        {/* ── Como funciona ────────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl text-[#c9a84c] text-center mb-8">
            {c.comoFuncionaTitulo}
          </h2>
          <ol className="space-y-5">
            {c.comoFunciona.map((passo, i) => (
              <li key={i} className="mystic-card p-6 flex gap-5 items-start">
                <span
                  aria-hidden
                  className="shrink-0 w-11 h-11 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/50 flex items-center justify-center font-serif text-[#c9a84c] text-xl font-bold"
                >
                  {i + 1}
                </span>
                <p className="text-[#e8e0d0] text-lg leading-relaxed">{passo}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── O que você recebe ────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl text-[#c9a84c] text-center mb-8">
            {c.oQueRecebeTitulo}
          </h2>
          <ul className="mystic-card p-7 space-y-4">
            {c.oQueRecebe.map((item, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span aria-hidden className="text-[#c9a84c] text-xl">
                  ✦
                </span>
                <p className="text-[#e8e0d0] text-lg leading-relaxed">{item}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── CTA intermediário ────────────────────────────────────────── */}
        {checkoutUrl && (
          <div className="text-center mb-12">
            <a
              href={checkoutUrl}
              className="btn-gold inline-block px-10 py-5 text-lg"
            >
              {c.cta} — {preco}
            </a>
          </div>
        )}

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl text-[#c9a84c] text-center mb-8">
            {c.faqTitulo}
          </h2>
          <div className="space-y-4">
            {c.faq.map((item, i) => (
              <details key={i} className="mystic-card p-6 group">
                <summary className="cursor-pointer text-[#e8e0d0] text-lg font-medium list-none flex justify-between items-center gap-4">
                  {item.pergunta}
                  <span
                    aria-hidden
                    className="text-[#c9a84c] text-2xl group-open:rotate-45 transition-transform"
                  >
                    +
                  </span>
                </summary>
                <p className="text-[#c2b9a4] text-lg leading-relaxed mt-4">
                  {item.resposta}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Disclaimers (rodapé) ─────────────────────────────────────── */}
        <footer className="border-t border-[#2a2a2a] pt-8 pb-12 text-center space-y-3">
          {c.disclaimerExtra && (
            <p className="text-[#c2b9a4] text-base leading-relaxed max-w-2xl mx-auto font-medium">
              {c.disclaimerExtra}
            </p>
          )}
          <p className="text-[#8a8272] text-sm leading-relaxed max-w-2xl mx-auto">
            {labels.disclaimer}
          </p>
          <p className="text-[#8a8272] text-sm leading-relaxed max-w-2xl mx-auto">
            {labels.arrependimento}
          </p>
        </footer>
      </div>
    </main>
  );
}
