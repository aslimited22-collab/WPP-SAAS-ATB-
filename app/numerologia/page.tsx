// ─── /numerologia — página de venda do Mapa Numerológico (R$45) ──────────────
// PT-hardcoded (produto BR-first; precedente: landing /google-ads). O CTA passa
// pelo roteador /api/checkout/numerologia: Brasil → Kiwify, intl → Stripe.
// CheckoutCta dispara o "Iniciar finalização de compra" no Google Ads antes
// de navegar (padrão da casa).

import type { Metadata } from "next";
import Link from "next/link";
import CheckoutCta from "@/app/components/CheckoutCta";

export const metadata: Metadata = {
  title: "Numerologia — Seus Números da Sorte Pessoais | ATB",
  description:
    "Descubra seus números da sorte pessoais, calculados pelo seu nome completo e data de nascimento. Mapa completo em PDF no seu e-mail em até 24h. Pagamento único de R$45.",
  alternates: { canonical: "https://atbtartot.com/numerologia" },
  robots: { index: true, follow: true },
};

const CHECKOUT = "/api/checkout/numerologia";
const CTA_LABEL = "Quero minha Numerologia — R$45";
const TRUST_LINE =
  "Pix, cartão ou boleto • Pagamento único • Chega em PDF no seu e-mail";

const recebe: [string, string, string][] = [
  [
    "🔢",
    "Seus números da sorte pessoais",
    "Calculados pela numerologia clássica a partir do seu nome completo e da sua data de nascimento. São seus, de mais ninguém.",
  ],
  [
    "📖",
    "O significado de cada número",
    "O que o seu Número do Destino, da Alma, de Expressão e do seu Ano Pessoal revelam sobre a sua vida, seu coração e seus dons.",
  ],
  [
    "🗓️",
    "Como e quando usar",
    "Orientações práticas: em que datas, decisões e momentos de proteção se apoiar em cada número.",
  ],
  [
    "📄",
    "Mapa completo em PDF",
    "Um documento bonito, feito com carinho, pra guardar pra sempre. Chega no seu e-mail em até 24h — normalmente em minutos.",
  ],
];

const passos: [string, string][] = [
  [
    "Você garante seu mapa",
    "Pagamento único de R$45 — Pix, cartão ou boleto, 100% seguro.",
  ],
  [
    "Você informa seus dados",
    "Só o seu nome completo e a sua data de nascimento. Leva 1 minuto.",
  ],
  [
    "Seu mapa chega no e-mail",
    "A ATB prepara seu mapa e ele chega em PDF, com seus números e todas as orientações.",
  ],
];

const faq: [string, string][] = [
  [
    "Como os números são calculados?",
    "Pela numerologia pitagórica clássica: seu nome completo e sua data de nascimento geram seus números pessoais — Destino, Alma, Expressão e Ano Pessoal.",
  ],
  [
    "Vou ter que pagar todo mês?",
    "Não. É pagamento único de R$45. O mapa é seu pra sempre.",
  ],
  [
    "Em quanto tempo recebo?",
    "Em até 24 horas no seu e-mail — na maioria das vezes, poucos minutos depois de você informar seus dados.",
  ],
  [
    "Serve pra jogar na loteria?",
    "Não prometemos ganhos em jogos ou dinheiro. Seus números são guias espirituais pra decisões, datas e proteção — use com fé e sabedoria.",
  ],
  [
    "Preciso instalar algo?",
    "Não. O mapa chega em PDF no seu e-mail. É só abrir no celular e guardar.",
  ],
];

export default function NumerologiaPage() {
  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a]/90">
        <div className="max-w-4xl mx-auto px-6 py-4 text-center">
          <Link href="/" className="font-serif text-xl no-underline">
            <span className="gold-gradient-text font-bold">ATB</span>
            <span className="text-[#e8e0d0] ml-1">TAROT</span>
          </Link>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-14 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-[#c9a84c] text-sm font-bold tracking-widest uppercase mb-5">
            ✦ Numerologia • Seus números, seu caminho
          </p>
          <h1 className="font-serif text-4xl md:text-5xl gold-gradient-text leading-tight mb-6">
            Descubra os números da sorte que nasceram com você
          </h1>
          <p className="text-lg text-[#c2b9a4] leading-relaxed mb-8">
            Seu nome completo e sua data de nascimento guardam números que falam
            do seu destino, do seu coração e dos seus dons. A{" "}
            <strong className="text-[#e8e0d0]">Numerologia</strong> da ATB revela
            cada um deles — e como usar — num mapa completo em PDF.
          </p>
          <CheckoutCta
            href={CHECKOUT}
            className="btn-gold inline-block px-10 py-5 rounded-xl text-lg max-w-md w-full"
          >
            ✦ {CTA_LABEL}
          </CheckoutCta>
          <p className="text-[#b5ab97] text-sm mt-4 leading-relaxed">{TRUST_LINE}</p>
        </div>
      </section>

      {/* ── O QUE VOCÊ RECEBE ──────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[#111111]/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl gold-gradient-text text-center mb-3">
            O que vem no seu mapa
          </h2>
          <p className="text-center text-[#c2b9a4] mb-10">
            Não é um número genérico da internet. É calculado do SEU nome e da
            SUA data.
          </p>
          <ul className="space-y-4">
            {recebe.map(([ic, t, d]) => (
              <li key={t} className="mystic-card p-5 flex items-start gap-4">
                <span className="text-3xl leading-none" aria-hidden="true">
                  {ic}
                </span>
                <div>
                  <p className="text-[#e4c97a] font-bold text-lg">{t}</p>
                  <p className="text-[#c2b9a4] mt-1 leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── COMO FUNCIONA ──────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl gold-gradient-text text-center mb-10">
            Como funciona — bem simples
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {passos.map(([t, d], i) => (
              <div key={t} className="mystic-card p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#c9a84c]/15 border-2 border-[#c9a84c] flex items-center justify-center">
                  <span className="text-[#c9a84c] font-serif text-2xl font-bold">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-[#c9a84c] font-serif text-xl mb-3">{t}</h3>
                <p className="text-[#c2b9a4] leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[#111111]/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl gold-gradient-text text-center mb-8">
            Perguntas comuns
          </h2>
          <div className="space-y-3">
            {faq.map(([q, a]) => (
              <details key={q} className="mystic-card px-5 py-1">
                <summary className="cursor-pointer py-4 font-semibold text-[#e8e0d0] text-base">
                  {q}
                </summary>
                <p className="pb-4 text-[#c2b9a4] leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── OFERTA FINAL ───────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-lg mx-auto mystic-card border-2 border-[#c9a84c]/50 shadow-gold p-10 text-center">
          <p className="text-[#c9a84c] text-sm font-bold tracking-widest uppercase mb-3">
            ✦ Numerologia
          </p>
          <p className="font-serif text-5xl text-white mb-1">R$45</p>
          <p className="text-[#c2b9a4] text-sm mb-6">
            pagamento único • mapa completo em PDF
          </p>
          <CheckoutCta
            href={CHECKOUT}
            className="btn-gold inline-block px-8 py-5 rounded-xl text-lg w-full"
          >
            ✦ {CTA_LABEL}
          </CheckoutCta>
          <p className="text-[#b5ab97] text-sm mt-4 leading-relaxed">{TRUST_LINE}</p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-[#2a2a2a] text-center">
        <p className="text-[#a39878] text-sm max-w-xl mx-auto leading-relaxed">
          A Numerologia da ATB é uma orientação espiritual e reflexiva. Não
          garante ganhos em jogos, dinheiro ou resultados materiais, e não
          substitui aconselhamento profissional.
        </p>
        <p className="text-[#a39878] text-sm mt-4">
          © {new Date().getFullYear()} ATB TAROT — Todos os direitos reservados
        </p>
      </footer>
    </main>
  );
}
