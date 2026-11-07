"use client";

// Landing de um Trabalho Espiritual — hero, como funciona (3 passos),
// o que você recebe, FAQ e disclaimers. CTA → checkout Kiwify (URL do banco).
// Público 60+: fonte grande, contraste alto, botões 56px+, foco visível.

import { formatRitualPrice } from "@/lib/ritual-pricing";
import type { Currency } from "@/lib/pricing";
import { StoreHeader } from "@/app/components/StoreHeader";
import { storefront } from "@/content/storefront";
import { rituals } from "@/content/rituals";
import CheckoutCta from "@/app/components/CheckoutCta";
import Link from "next/link";
import { useUiLocale, type UiLocale } from "@/lib/use-locale";
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

export default function ServicoLandingClient({
  service, initialLocale, currency,
}: {
  initialLocale: UiLocale;
  currency: Currency;
  service: ServiceProps;
}) {
  const [locale, setLocale] = useUiLocale(initialLocale);
  const c = SERVICOS_CONTENT[locale][service.slug as ServiceSlug];
  const labels = SERVICOS_LABELS[locale];
  const preco = formatRitualPrice(service.slug as ServiceSlug, currency, service.preco_centavos, locale);
  const checkoutUrl = currency === "brl" && !service.kiwify_checkout_url
    ? null : `/api/checkout/ritual/${service.slug}?lang=${locale}`;
  const r = rituals[locale];
  const copy = storefront[locale];
  const product = r.services[service.slug as ServiceSlug];
  if (locale !== "pt-BR") {
    return <div className="atb-shop atb-funnel" lang={locale}>
      <StoreHeader locale={locale} onLocale={setLocale} />
      <main className="atb-ritual-detail atb-wrap">
        <Link href={`/servicos?lang=${locale}`}>← {copy.rituals}</Link>
        <h1>{product.title}</h1><p>{product.description}</p>
        <section><h2>{copy.how}</h2><p>{r.instructions}</p></section>
        <div className="atb-ritual-buy"><strong>{preco}</strong><p>{copy.once}</p>
          {checkoutUrl ? <CheckoutCta href={checkoutUrl} className="atb-cta">{r.buy} →</CheckoutCta> : <p>{copy.checkoutError}</p>}
        </div>
        <footer><p>{r.refund}</p><p>{copy.notice}</p>{service.slug === "devocao-a-xango" && <p>{r.legal}</p>}</footer>
      </main></div>;
  }

  return (
    <div className="atb-shop atb-funnel" lang={locale}><StoreHeader locale={locale} onLocale={setLocale} /><main className="atb-services">
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
          <span className="atb-service-star" aria-hidden="true">✦</span>
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
              <CheckoutCta
                href={checkoutUrl}
                className="btn-gold block w-full px-10 py-5 text-lg text-center"
              >
                {c.cta}
              </CheckoutCta>
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
            <CheckoutCta
              href={checkoutUrl}
              className="btn-gold inline-block px-10 py-5 text-lg"
            >
              {c.cta} — {preco}
            </CheckoutCta>
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
    </main></div>
  );
}
