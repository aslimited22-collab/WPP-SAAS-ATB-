"use client";

// Página de vendas global — trilíngue (PT/EN/ES) e desenhada para o público
// 60+: letras grandes, frases curtas, passos numerados e botões enormes.
// O checkout passa pelo roteador /api/checkout/[plan]: Brasil → Kiwify,
// resto do mundo → Stripe na moeda local.

import Link from "next/link";
import { useUiLocale, LOCALE_LABELS, type UiLocale } from "@/lib/use-locale";

const DICT: Record<
  UiLocale,
  {
    enter: string;
    heroTag: string;
    heroSubtitle: string;
    heroText: string;
    ctaMain: string;
    howTitle: string;
    steps: { title: string; desc: string }[];
    productsTitle: string;
    productsSubtitle: string;
    planTitle: string;
    planPrice: string;
    planPer: string;
    planBenefits: string[];
    planCta: string;
    planNote: string;
    perguntasTitle: string;
    perguntasDesc: string;
    pergunta1: string;
    pergunta3: string;
    pergunta7: string;
    limpezaTitle: string;
    limpezaDesc: string;
    limpezaCta: string;
    trustTitle: string;
    trust: string[];
    disclaimer: string;
  }
> = {
  "pt-BR": {
    enter: "Entrar",
    heroTag: "✦ O Oráculo que Fala a Sua Língua ✦",
    heroSubtitle: "Leituras místicas e personalizadas",
    heroText:
      "A ATB interpreta os sinais do destino especialmente para você. Você recebe sua leitura no WhatsApp e pode conversar com a ATB a qualquer hora, direto daqui.",
    ctaMain: "✦ Começar Agora",
    howTitle: "Simples de Usar — Veja Como",
    steps: [
      {
        title: "Escolha e pague",
        desc: "Aperte o botão dourado e pague com cartão ou Pix. É rápido e seguro.",
      },
      {
        title: "Abra seu e-mail",
        desc: "Você recebe um e-mail com um botão dourado. Aperte nele e pronto: você já está dentro.",
      },
      {
        title: "Receba sua leitura",
        desc: "Converse com a ATB ou peça sua leitura. Ela responde na hora, no seu idioma.",
      },
    ],
    productsTitle: "Escolha o que seu coração pede",
    productsSubtitle: "Pagamento em reais no Brasil · em dólar ou euro no resto do mundo",
    planTitle: "Plano Mensal",
    planPrice: "R$29",
    planPer: "por mês · cancele quando quiser",
    planBenefits: [
      "5 leituras de tarot por mês no WhatsApp",
      "30 conversas com a ATB por mês",
      "Histórico de todas as suas leituras",
      "Tudo no seu idioma",
    ],
    planCta: "Assinar por R$29/mês",
    planNote:
      "Após o pagamento, você recebe um e-mail com o botão de acesso à sua conta.",
    perguntasTitle: "Perguntas Avulsas",
    perguntasDesc:
      "Sem assinatura. Compre perguntas e converse com a ATB quando quiser.",
    pergunta1: "1 pergunta — R$14,90",
    pergunta3: "3 perguntas — R$19,90",
    pergunta7: "7 perguntas — R$39,90",
    limpezaTitle: "Limpeza Espiritual Personalizada",
    limpezaDesc:
      "Uma leitura sagrada única preparada pela ATB para o seu momento: descarrego, proteção e passos práticos. Chega por e-mail e WhatsApp.",
    limpezaCta: "✦ Quero minha Limpeza — R$100",
    trustTitle: "Pode comprar tranquila",
    trust: [
      "Pagamento 100% seguro (Kiwify e Stripe)",
      "Acesso enviado por e-mail em minutos",
      "Atendimento no seu idioma",
      "Cancele a assinatura quando quiser",
    ],
    disclaimer:
      "As leituras do ATB TAROT IA têm caráter de entretenimento e reflexão. Não substituem aconselhamento profissional.",
  },
  en: {
    enter: "Sign in",
    heroTag: "✦ The Oracle that Speaks Your Language ✦",
    heroSubtitle: "Mystical, personalized readings",
    heroText:
      "ATB interprets the signs of destiny especially for you. Get your reading on WhatsApp and talk to ATB anytime, right from here.",
    ctaMain: "✦ Start Now",
    howTitle: "Easy to Use — Here's How",
    steps: [
      {
        title: "Choose and pay",
        desc: "Tap the golden button and pay with your card. Quick and secure.",
      },
      {
        title: "Open your email",
        desc: "You'll get an email with a golden button. Tap it and you're in.",
      },
      {
        title: "Receive your reading",
        desc: "Chat with ATB or request your reading. She answers right away, in your language.",
      },
    ],
    productsTitle: "Choose what your heart needs",
    productsSubtitle: "Pay in your own currency — dollars, euros and more",
    planTitle: "Monthly Plan",
    planPrice: "$9",
    planPer: "per month · cancel anytime",
    planBenefits: [
      "5 tarot readings per month on WhatsApp",
      "30 conversations with ATB per month",
      "History of all your readings",
      "Everything in your language",
    ],
    planCta: "Subscribe for $9/month",
    planNote: "After payment, you'll receive an email with your access button.",
    perguntasTitle: "Single Questions",
    perguntasDesc:
      "No subscription. Buy questions and talk to ATB whenever you want.",
    pergunta1: "1 question — $3",
    pergunta3: "3 questions — $4",
    pergunta7: "7 questions — $8",
    limpezaTitle: "Personalized Spiritual Cleansing",
    limpezaDesc:
      "A unique sacred reading prepared by ATB for your moment: cleansing, protection and practical steps. Delivered by email and WhatsApp.",
    limpezaCta: "✦ I want my Cleansing — $19",
    trustTitle: "Buy with confidence",
    trust: [
      "100% secure payment (Stripe)",
      "Access emailed within minutes",
      "Support in your language",
      "Cancel your subscription anytime",
    ],
    disclaimer:
      "ATB TAROT AI readings are for entertainment and reflection. They do not replace professional advice.",
  },
  es: {
    enter: "Entrar",
    heroTag: "✦ El Oráculo que Habla Tu Idioma ✦",
    heroSubtitle: "Lecturas místicas y personalizadas",
    heroText:
      "ATB interpreta las señales del destino especialmente para ti. Recibe tu lectura en WhatsApp y habla con ATB en cualquier momento, desde aquí.",
    ctaMain: "✦ Empezar Ahora",
    howTitle: "Fácil de Usar — Así Funciona",
    steps: [
      {
        title: "Elige y paga",
        desc: "Toca el botón dorado y paga con tu tarjeta. Rápido y seguro.",
      },
      {
        title: "Abre tu correo",
        desc: "Recibirás un correo con un botón dorado. Tócalo y ya estás dentro.",
      },
      {
        title: "Recibe tu lectura",
        desc: "Habla con ATB o pide tu lectura. Ella responde al instante, en tu idioma.",
      },
    ],
    productsTitle: "Elige lo que tu corazón necesita",
    productsSubtitle: "Paga en tu moneda — dólares, euros y más",
    planTitle: "Plan Mensual",
    planPrice: "$9",
    planPer: "por mes · cancela cuando quieras",
    planBenefits: [
      "5 lecturas de tarot al mes en WhatsApp",
      "30 conversaciones con ATB al mes",
      "Historial de todas tus lecturas",
      "Todo en tu idioma",
    ],
    planCta: "Suscribirme por $9/mes",
    planNote: "Después del pago, recibirás un correo con tu botón de acceso.",
    perguntasTitle: "Preguntas Sueltas",
    perguntasDesc:
      "Sin suscripción. Compra preguntas y habla con ATB cuando quieras.",
    pergunta1: "1 pregunta — $3",
    pergunta3: "3 preguntas — $4",
    pergunta7: "7 preguntas — $8",
    limpezaTitle: "Limpieza Espiritual Personalizada",
    limpezaDesc:
      "Una lectura sagrada única preparada por ATB para tu momento: limpieza, protección y pasos prácticos. Llega por correo y WhatsApp.",
    limpezaCta: "✦ Quiero mi Limpieza — $19",
    trustTitle: "Compra con tranquilidad",
    trust: [
      "Pago 100% seguro (Stripe)",
      "Acceso enviado por correo en minutos",
      "Atención en tu idioma",
      "Cancela tu suscripción cuando quieras",
    ],
    disclaimer:
      "Las lecturas de ATB TAROT IA son de entretenimiento y reflexión. No sustituyen el consejo profesional.",
  },
};

export default function LandingPage() {
  const [locale, setLocale] = useUiLocale();
  const t = DICT[locale];

  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg">
      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a]">
        <div className="font-serif text-xl">
          <span className="gold-gradient-text font-bold">ATB</span>
          <span className="text-[#e8e0d0] ml-1">TAROT IA</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {(Object.keys(LOCALE_LABELS) as UiLocale[]).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              aria-label={LOCALE_LABELS[l]}
              className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                locale === l
                  ? "border-[#c9a84c] text-[#c9a84c] bg-[#c9a84c]/10"
                  : "border-[#3a3a3a] text-[#b5ab97] hover:text-[#c9a84c]"
              }`}
            >
              {l === "pt-BR" ? "PT" : l.toUpperCase()}
            </button>
          ))}
          <Link
            href="/login"
            className="text-[#c9a84c] border border-[#c9a84c]/50 px-4 py-2 rounded-lg text-sm font-semibold hover:border-[#c9a84c] transition-colors"
          >
            {t.enter}
          </Link>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-36 pb-20">
        <div className="animate-fade-in max-w-3xl mx-auto">
          <p className="text-[#c9a84c] text-base font-medium tracking-widest uppercase mb-6 opacity-90">
            {t.heroTag}
          </p>
          <h1 className="text-5xl md:text-7xl font-serif mb-6 leading-tight">
            <span className="gold-gradient-text">ATB TAROT IA</span>
          </h1>
          <p className="text-2xl md:text-3xl text-[#e8e0d0]/90 font-serif italic mb-6">
            {t.heroSubtitle}
          </p>
          <p className="text-lg text-[#c2b9a4] mb-10 max-w-xl mx-auto leading-relaxed">
            {t.heroText}
          </p>

          <a
            href="#produtos"
            className="btn-gold text-xl px-10 py-5 rounded-xl inline-block"
          >
            {t.ctaMain}
          </a>
        </div>
      </section>

      {/* ── COMO FUNCIONA (3 passos numerados, linguagem simples) ─────────── */}
      <section className="py-20 px-6 bg-[#111111]/50" id="como-funciona">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-serif gold-gradient-text mb-4">
              {t.howTitle}
            </h2>
            <div className="divider-gold" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {t.steps.map((item, i) => (
              <div key={i} className="mystic-card p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#c9a84c]/15 border-2 border-[#c9a84c] flex items-center justify-center">
                  <span className="text-[#c9a84c] font-serif text-3xl font-bold">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-[#c9a84c] font-serif text-2xl mb-3">
                  {item.title}
                </h3>
                <p className="text-[#c2b9a4] text-base leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUTOS ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-6" id="produtos">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-3xl md:text-4xl font-serif gold-gradient-text mb-3">
              {t.productsTitle}
            </h2>
            <p className="text-[#b5ab97] text-base mb-10">{t.productsSubtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Assinatura */}
            <div className="mystic-card p-9 border-2 border-[#c9a84c]/40 shadow-gold flex flex-col">
              <div className="text-[#b5ab97] text-base mb-2">{t.planTitle}</div>
              <div className="font-serif text-6xl gold-gradient-text font-bold mb-1">
                {t.planPrice}
              </div>
              <div className="text-[#aca189] text-base mb-8">{t.planPer}</div>

              <ul className="text-left space-y-4 mb-9 flex-1">
                {t.planBenefits.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-start gap-3 text-base text-[#e8e0d0]/90 leading-relaxed"
                  >
                    <span className="text-[#c9a84c] text-xl leading-none mt-0.5">
                      ✦
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>

              <a
                href="/api/checkout/basic"
                className="btn-gold w-full text-center block text-lg py-5 rounded-xl"
              >
                {t.planCta}
              </a>
              <p className="text-[#a39878] text-sm mt-4 text-center leading-relaxed">
                {t.planNote}
              </p>
            </div>

            <div className="flex flex-col gap-8">
              {/* Perguntas avulsas */}
              <div className="mystic-card p-8 flex-1">
                <div className="text-3xl mb-2">💬</div>
                <h3 className="font-serif text-2xl text-[#c9a84c] mb-2">
                  {t.perguntasTitle}
                </h3>
                <p className="text-[#c2b9a4] text-base leading-relaxed mb-6">
                  {t.perguntasDesc}
                </p>
                <div className="flex flex-col gap-3">
                  <a
                    href="/api/checkout/pergunta1"
                    className="text-[#c9a84c] border-2 border-[#c9a84c]/50 px-6 py-4 rounded-xl text-base font-semibold hover:border-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors text-center"
                  >
                    {t.pergunta1}
                  </a>
                  <a
                    href="/api/checkout/pergunta3"
                    className="text-[#c9a84c] border-2 border-[#c9a84c]/50 px-6 py-4 rounded-xl text-base font-semibold hover:border-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors text-center"
                  >
                    {t.pergunta3}
                  </a>
                  <a
                    href="/api/checkout/pergunta7"
                    className="btn-gold px-6 py-4 rounded-xl text-base text-center"
                  >
                    {t.pergunta7}
                  </a>
                </div>
              </div>

              {/* Limpeza */}
              <div className="mystic-card p-8 flex-1">
                <div className="text-3xl mb-2">🕊️</div>
                <h3 className="font-serif text-2xl text-[#c9a84c] mb-2">
                  {t.limpezaTitle}
                </h3>
                <p className="text-[#c2b9a4] text-base leading-relaxed mb-6">
                  {t.limpezaDesc}
                </p>
                <Link
                  href="/limpeza"
                  className="btn-gold inline-block px-8 py-4 rounded-xl text-base w-full text-center"
                >
                  {t.limpezaCta}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONFIANÇA ──────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[#111111]/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-serif gold-gradient-text mb-8">
            {t.trustTitle}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {t.trust.map((item) => (
              <div key={item} className="flex items-start gap-3 mystic-card p-5">
                <span className="text-[#c9a84c] text-2xl leading-none">✓</span>
                <span className="text-[#e8e0d0]/90 text-base leading-relaxed">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-[#2a2a2a] text-center">
        <div className="font-serif text-lg mb-3">
          <span className="gold-gradient-text font-bold">ATB</span>
          <span className="text-[#e8e0d0] ml-1">TAROT IA</span>
        </div>
        <p className="text-[#a39878] text-sm max-w-md mx-auto mb-6 leading-relaxed">
          {t.disclaimer}
        </p>
        <div className="flex justify-center gap-6 text-base text-[#a39878]">
          <Link
            href="/login"
            className="hover:text-[#c9a84c] transition-colors underline"
          >
            {t.enter}
          </Link>
          <span>·</span>
          <span>© {new Date().getFullYear()} ATB TAROT IA</span>
        </div>
      </footer>
    </main>
  );
}
