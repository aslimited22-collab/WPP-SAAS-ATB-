"use client";

import Image from "next/image";
import Link from "next/link";
import CheckoutCta from "./components/CheckoutCta";
import { Brand, StoreHeader } from "./components/StoreHeader";
import { storefront } from "@/content/storefront";
import { useUiLocale, type UiLocale } from "@/lib/use-locale";
import { formatProductPrice, type Currency } from "@/lib/pricing";

type Props = { currency: Currency; initialLocale: UiLocale; showMap: boolean; checkoutFailed: boolean };
const Arrow = () => <span className="atb-arrow" aria-hidden="true">→</span>;
function Cover({ src }: { src: string }) {
  return <div className="atb-cover"><Image src={src} alt="" fill sizes="(max-width: 720px) 94vw, (max-width: 1000px) 46vw, 385px" /></div>;
}

export default function Storefront({ currency, initialLocale, showMap, checkoutFailed }: Props) {
  const [locale, setLocale] = useUiLocale(initialLocale);
  const t = storefront[locale];
  return <div className="atb-shop" lang={locale}>
    <StoreHeader locale={locale} onLocale={setLocale} />
    <main>
      <section className="atb-hero">
        <div className="atb-wrap atb-hero-grid">
          <div className="atb-intro">
            <div className="atb-sky" aria-hidden="true"><i />✦<i /></div>
            <h1>{t.heading[0]} <em>{t.heading[1]}</em></h1>
            <p>{t.intro}</p>
            <a className="atb-cta" href="#produtos">{t.choose}<Arrow /></a>
          </div>
          <div className="atb-art"><div className="atb-arch">
            <Image src="/images/soleil.webp" alt="" width={1536} height={1024} sizes="(max-width: 720px) 94vw, (max-width: 1300px) 48vw, 600px" priority />
          </div></div>
        </div>
      </section>
      <section className="atb-catalog" id="assinar">
        <div className="atb-wrap" id="produtos">
          <div className="atb-section-head"><h2>{t.catalog}</h2><span>{t.once}</span></div>
          {checkoutFailed && <p className="atb-alert" role="alert">{t.checkoutError}</p>}
          <div className="atb-cards">
            <article className="atb-card">
              <Cover src="/images/hero-tarot.webp" /><div className="atb-card-body">
                <h3>{t.chat}</h3><p>{t.chatText}</p>
                <div className="atb-offers">
                  {(["pergunta3", "pergunta7"] as const).map((plan, i) =>
                    <CheckoutCta key={plan} href={`/api/checkout/${plan}?lang=${locale}`} className="atb-offer">
                      <span>{t.packs[i]}</span><strong>{formatProductPrice(plan, currency, locale)}</strong><Arrow />
                    </CheckoutCta>)}
                </div>
              </div>
            </article>
            <article className="atb-card">
              <Cover src="/images/limpeza.webp" /><div className="atb-card-body">
                <h3>{t.cleansing}</h3><p>{t.cleansingText}</p><Link href={`/limpeza?lang=${locale}`} className="atb-offer">
                  <span>{t.view}</span><strong>{formatProductPrice("limpeza", currency, locale)}</strong><Arrow />
                </Link>
              </div>
            </article>
            <article className="atb-card">
              <Cover src="/images/chat-atb.webp" /><div className="atb-card-body">
                <h3>{t.rituals}</h3><p>{t.ritualsText}</p>
                <Link href={`/servicos?lang=${locale}`} className="atb-offer"><span>{t.seeRituals}</span><Arrow /></Link>
              </div>
            </article>
          </div>
          {showMap && <div className="atb-map"><div><h3>{t.map}</h3><p>{t.mapText}</p></div>
            <Link href="/numerologia" className="atb-offer"><span>{t.view}</span><strong>{formatProductPrice("numerologia", currency, locale)}</strong><Arrow /></Link></div>}
        </div>
      </section>
      <section id="como-funciona" className="atb-guide"><div className="atb-wrap">
        <h2>{t.how}</h2><ol>{t.steps.map(([title, text], i) => <li key={title}>
          <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p>
        </li>)}</ol>
      </div></section>
      <section className="atb-faq atb-wrap"><h2>{t.faqTitle}</h2><div>
        {t.faq.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </div></section>
    </main>
    <footer className="atb-footer"><div className="atb-wrap"><Brand /><p>{t.notice}</p><Link href={`/login?lang=${locale}`}>{t.portal} ↗</Link></div></footer>
  </div>;
}
