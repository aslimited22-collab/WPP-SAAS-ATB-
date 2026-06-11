"use client";

// Página de vendas global — multilíngue (PT/EN/ES/DE/IT) e desenhada para o público
// 60+: letras grandes, frases curtas, passos numerados e botões enormes.
// O checkout passa pelo roteador /api/checkout/[plan]: Brasil → Kiwify,
// resto do mundo → Stripe na moeda local.

import Link from "next/link";
import Image from "next/image";
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
    heroTag: "✦ Você chegou até aqui. Isso não foi por acaso. ✦",
    heroSubtitle: "A mensagem que tocou seu coração era para você",
    heroText:
      "Minha querida alma, se algo dentro de você se mexeu ao ouvir a ATB, é porque as suas respostas já estão prontas. O amor, a família, o dinheiro, aquela inveja que trava os seus caminhos... tudo isso tem resposta — e ela chega em minutos, com carinho, direto no seu celular.",
    ctaMain: "✦ Quero Minha Resposta Agora",
    howTitle: "Em 2 Minutos Você Já Está Falando com a ATB",
    steps: [
      {
        title: "Escolha e pague",
        desc: "Aperte o botão dourado e pague com cartão ou Pix, em segundos. Seguro como no banco.",
      },
      {
        title: "Abra seu e-mail",
        desc: "Chega um e-mail com um botão dourado. Um toque, e a porta do seu portal se abre.",
      },
      {
        title: "Receba o que seu coração pediu",
        desc: "Faça sua pergunta e a ATB responde na hora, com o carinho de quem entende a sua vida.",
      },
    ],
    productsTitle: "O que está pesando no seu coração hoje?",
    productsSubtitle:
      "Escolha abaixo — quanto mais cedo você pergunta, mais cedo a resposta chega · no Brasil em reais, no exterior na moeda da sua região",
    planTitle: "Plano Mensal — para ter a ATB sempre por perto",
    planPrice: "R$29",
    planPer: "menos de R$1 por dia · cancele quando quiser",
    planBenefits: [
      "5 leituras completas de tarot por mês, direto no seu WhatsApp",
      "30 conversas com a ATB — pergunte sobre amor, família, dinheiro",
      "Suas leituras ficam guardadas para reler quando o coração apertar",
      "Tudo no seu idioma, com letras grandes e fáceis",
    ],
    planCta: "✦ Sim, quero a ATB comigo — R$29/mês",
    planNote:
      "O acesso chega no seu e-mail em minutos. Cancele quando quiser, sem ligação e sem explicação.",
    perguntasTitle: "Só uma pergunta apertando o peito?",
    perguntasDesc:
      "Sem assinatura, sem compromisso. Pague uma vez e pergunte agora — sobre ele, sobre a família, sobre aquilo que não te deixa dormir.",
    pergunta1: "1 pergunta — R$14,90",
    pergunta3: "3 perguntas — R$19,90 · a mais escolhida",
    pergunta7: "7 perguntas — R$39,90 · melhor valor",
    limpezaTitle: "Sente um peso que não é seu?",
    limpezaDesc:
      "Olho gordo, inveja, caminhos que fecham sem explicação... A ATB prepara a SUA Limpeza Espiritual: o que está travado, de onde vem, e os passos para se libertar. Chega por e-mail e WhatsApp, sua para sempre.",
    limpezaCta: "✦ Quero me libertar disso — R$100",
    trustTitle: "Pode ficar tranquila",
    trust: [
      "Pagamento 100% seguro (Kiwify e Stripe, os mesmos dos grandes sites)",
      "Acesso no seu e-mail em minutos — sem complicação nenhuma",
      "Tudo no seu idioma, com letras grandes e fáceis de ler",
      "Cancele a assinatura quando quiser, sem ligação e sem perguntas",
    ],
    disclaimer:
      "As leituras do ATB TAROT IA têm caráter de entretenimento e reflexão. Não substituem aconselhamento profissional.",
  },
  en: {
    enter: "Sign in",
    heroTag: "✦ You found your way here. That was no accident. ✦",
    heroSubtitle: "The message that touched your heart was meant for you",
    heroText:
      "Dear soul, if something stirred inside you while listening to ATB, it's because your answers are already waiting. Love, family, money, that envy blocking your path... it all has an answer — and it reaches you in minutes, with warmth, right on your phone.",
    ctaMain: "✦ I Want My Answer Now",
    howTitle: "In 2 Minutes You're Already Talking to ATB",
    steps: [
      {
        title: "Choose and pay",
        desc: "Tap the golden button and pay with your card, in seconds. Bank-level secure.",
      },
      {
        title: "Open your email",
        desc: "An email arrives with a golden button. One tap, and the door to your portal opens.",
      },
      {
        title: "Receive what your heart asked for",
        desc: "Ask your question and ATB answers right away, with the warmth of someone who understands your life.",
      },
    ],
    productsTitle: "What is weighing on your heart today?",
    productsSubtitle:
      "Choose below — the sooner you ask, the sooner your answer arrives · you pay in your region's currency",
    planTitle: "Monthly Plan — keep ATB close, always",
    planPrice: "$9",
    planPer: "less than 30¢ a day · cancel anytime",
    planBenefits: [
      "5 full tarot readings per month, right on your WhatsApp",
      "30 conversations with ATB — ask about love, family, money",
      "Your readings are saved to reread whenever your heart needs",
      "Everything in your language, in large, easy letters",
    ],
    planCta: "✦ Yes, I want ATB with me — $9/month",
    planNote:
      "Your access arrives by email within minutes. Cancel anytime, no calls, no questions.",
    perguntasTitle: "Just one question pressing on your chest?",
    perguntasDesc:
      "No subscription, no commitment. Pay once and ask now — about him, about family, about what keeps you up at night.",
    pergunta1: "1 question — $3",
    pergunta3: "3 questions — $4 · most chosen",
    pergunta7: "7 questions — $8 · best value",
    limpezaTitle: "Feeling a weight that isn't yours?",
    limpezaDesc:
      "Evil eye, envy, paths that close for no reason... ATB prepares YOUR Spiritual Cleansing: what is blocked, where it comes from, and the steps to set yourself free. Delivered by email and WhatsApp, yours forever.",
    limpezaCta: "✦ I want to be free of this — $19",
    trustTitle: "You can feel at ease",
    trust: [
      "100% secure payment (Stripe — trusted by the world's biggest sites)",
      "Access in your email within minutes — no complications",
      "Everything in your language, in large, easy-to-read letters",
      "Cancel your subscription anytime, no calls, no questions",
    ],
    disclaimer:
      "ATB TAROT AI readings are for entertainment and reflection. They do not replace professional advice.",
  },
  es: {
    enter: "Entrar",
    heroTag: "✦ Llegaste hasta aquí. No fue casualidad. ✦",
    heroSubtitle: "El mensaje que tocó tu corazón era para ti",
    heroText:
      "Querida alma, si algo se movió dentro de ti al escuchar a ATB, es porque tus respuestas ya están listas. El amor, la familia, el dinero, esa envidia que cierra tus caminos... todo eso tiene respuesta — y llega en minutos, con cariño, directo a tu celular.",
    ctaMain: "✦ Quiero Mi Respuesta Ahora",
    howTitle: "En 2 Minutos Ya Estás Hablando con ATB",
    steps: [
      {
        title: "Elige y paga",
        desc: "Toca el botón dorado y paga con tu tarjeta, en segundos. Seguro como en el banco.",
      },
      {
        title: "Abre tu correo",
        desc: "Llega un correo con un botón dorado. Un toque, y la puerta de tu portal se abre.",
      },
      {
        title: "Recibe lo que tu corazón pidió",
        desc: "Haz tu pregunta y ATB responde al instante, con el cariño de quien entiende tu vida.",
      },
    ],
    productsTitle: "¿Qué está pesando en tu corazón hoy?",
    productsSubtitle:
      "Elige abajo — cuanto antes preguntes, antes llega tu respuesta · pagas en la moneda de tu región",
    planTitle: "Plan Mensual — para tener a ATB siempre cerca",
    planPrice: "$9",
    planPer: "menos de 30¢ al día · cancela cuando quieras",
    planBenefits: [
      "5 lecturas completas de tarot al mes, directo a tu WhatsApp",
      "30 conversaciones con ATB — pregunta sobre amor, familia, dinero",
      "Tus lecturas quedan guardadas para releer cuando el corazón apriete",
      "Todo en tu idioma, con letras grandes y fáciles",
    ],
    planCta: "✦ Sí, quiero a ATB conmigo — $9/mes",
    planNote:
      "Tu acceso llega al correo en minutos. Cancela cuando quieras, sin llamadas y sin preguntas.",
    perguntasTitle: "¿Solo una pregunta apretando el pecho?",
    perguntasDesc:
      "Sin suscripción, sin compromiso. Paga una vez y pregunta ahora — sobre él, sobre la familia, sobre eso que no te deja dormir.",
    pergunta1: "1 pregunta — $3",
    pergunta3: "3 preguntas — $4 · la más elegida",
    pergunta7: "7 preguntas — $8 · mejor valor",
    limpezaTitle: "¿Sientes un peso que no es tuyo?",
    limpezaDesc:
      "Mal de ojo, envidia, caminos que se cierran sin explicación... ATB prepara TU Limpieza Espiritual: qué está bloqueado, de dónde viene, y los pasos para liberarte. Llega por correo y WhatsApp, tuya para siempre.",
    limpezaCta: "✦ Quiero liberarme de esto — $19",
    trustTitle: "Puedes quedarte tranquila",
    trust: [
      "Pago 100% seguro (Stripe — el mismo de los grandes sitios)",
      "Acceso en tu correo en minutos — sin complicaciones",
      "Todo en tu idioma, con letras grandes y fáciles de leer",
      "Cancela tu suscripción cuando quieras, sin llamadas ni preguntas",
    ],
    disclaimer:
      "Las lecturas de ATB TAROT IA son de entretenimiento y reflexión. No sustituyen el consejo profesional.",
  },
  de: {
    enter: "Anmelden",
    heroTag: "✦ Du bist hier gelandet. Das war kein Zufall. ✦",
    heroSubtitle: "Die Botschaft, die dein Herz berührt hat, war für dich",
    heroText:
      "Meine liebe Seele, wenn sich etwas in dir geregt hat, als du ATB gehört hast, dann weil deine Antworten schon bereit sind. Die Liebe, die Familie, das Geld, dieser Neid, der deine Wege blockiert... all das hat eine Antwort — und sie erreicht dich in Minuten, voller Wärme, direkt auf deinem Handy.",
    ctaMain: "✦ Ich will meine Antwort jetzt",
    howTitle: "In 2 Minuten sprichst du schon mit ATB",
    steps: [
      {
        title: "Wählen und bezahlen",
        desc: "Tippe auf den goldenen Knopf und zahle mit deiner Karte, in Sekunden. Sicher wie bei der Bank.",
      },
      {
        title: "E-Mail öffnen",
        desc: "Eine E-Mail mit einem goldenen Knopf kommt an. Ein Tipp — und die Tür zu deinem Portal öffnet sich.",
      },
      {
        title: "Empfange, worum dein Herz gebeten hat",
        desc: "Stelle deine Frage und ATB antwortet sofort, mit der Wärme von jemandem, der dein Leben versteht.",
      },
    ],
    productsTitle: "Was liegt dir heute auf dem Herzen?",
    productsSubtitle:
      "Wähle unten — je früher du fragst, desto früher kommt deine Antwort",
    planTitle: "Monatsplan — damit ATB immer bei dir ist",
    planPrice: "8 €",
    planPer: "weniger als 27 Cent am Tag · jederzeit kündbar",
    planBenefits: [
      "5 vollständige Tarot-Legungen pro Monat, direkt per WhatsApp",
      "30 Gespräche mit ATB — frage nach Liebe, Familie, Geld",
      "Deine Legungen bleiben gespeichert, zum Nachlesen, wenn das Herz schwer wird",
      "Alles in deiner Sprache, in großen, gut lesbaren Buchstaben",
    ],
    planCta: "✦ Ja, ich will ATB an meiner Seite — 8 €/Monat",
    planNote:
      "Dein Zugang kommt in Minuten per E-Mail. Kündige jederzeit, ohne Anruf, ohne Fragen.",
    perguntasTitle: "Nur eine Frage, die dir auf der Brust liegt?",
    perguntasDesc:
      "Ohne Abo, ohne Verpflichtung. Zahle einmal und frage jetzt — über ihn, über die Familie, über das, was dich nachts nicht schlafen lässt.",
    pergunta1: "1 Frage — 2,80 €",
    pergunta3: "3 Fragen — 3,80 € · am häufigsten gewählt",
    pergunta7: "7 Fragen — 7,50 € · bestes Angebot",
    limpezaTitle: "Spürst du eine Last, die nicht deine ist?",
    limpezaDesc:
      "Böser Blick, Neid, Wege, die sich ohne Grund verschließen... ATB bereitet DEINE Spirituelle Reinigung vor: was blockiert ist, woher es kommt, und die Schritte, um dich zu befreien. Kommt per E-Mail und WhatsApp — für immer deine.",
    limpezaCta: "✦ Ich will mich davon befreien — 18 €",
    trustTitle: "Du kannst ganz beruhigt sein",
    trust: [
      "100 % sichere Zahlung (Stripe — wie bei den größten Websites)",
      "Zugang in wenigen Minuten per E-Mail — ganz ohne Kompliziertes",
      "Alles in deiner Sprache, in großen, gut lesbaren Buchstaben",
      "Abo jederzeit kündbar, ohne Anruf, ohne Fragen",
    ],
    disclaimer:
      "Die Legungen von ATB TAROT IA dienen der Unterhaltung und Besinnung. Sie ersetzen keine professionelle Beratung.",
  },
  it: {
    enter: "Accedi",
    heroTag: "✦ Sei arrivata fin qui. Non è stato un caso. ✦",
    heroSubtitle: "Il messaggio che ha toccato il tuo cuore era per te",
    heroText:
      "Anima cara, se qualcosa si è mosso dentro di te ascoltando ATB, è perché le tue risposte sono già pronte. L'amore, la famiglia, il denaro, quell'invidia che blocca le tue strade... tutto questo ha una risposta — e arriva in pochi minuti, con calore, direttamente sul tuo telefono.",
    ctaMain: "✦ Voglio la Mia Risposta Adesso",
    howTitle: "In 2 Minuti Stai Già Parlando con ATB",
    steps: [
      {
        title: "Scegli e paga",
        desc: "Tocca il pulsante dorato e paga con la tua carta, in pochi secondi. Sicuro come in banca.",
      },
      {
        title: "Apri la tua email",
        desc: "Arriva un'email con un pulsante dorato. Un tocco, e la porta del tuo portale si apre.",
      },
      {
        title: "Ricevi ciò che il tuo cuore ha chiesto",
        desc: "Fai la tua domanda e ATB risponde subito, con il calore di chi capisce la tua vita.",
      },
    ],
    productsTitle: "Cosa ti pesa sul cuore oggi?",
    productsSubtitle:
      "Scegli qui sotto — prima chiedi, prima arriva la tua risposta",
    planTitle: "Piano Mensile — per avere ATB sempre vicina",
    planPrice: "8 €",
    planPer: "meno di 27 centesimi al giorno · disdici quando vuoi",
    planBenefits: [
      "5 letture complete di tarocchi al mese, direttamente su WhatsApp",
      "30 conversazioni con ATB — chiedi di amore, famiglia, denaro",
      "Le tue letture restano salvate, da rileggere quando il cuore si stringe",
      "Tutto nella tua lingua, con lettere grandi e facili",
    ],
    planCta: "✦ Sì, voglio ATB con me — 8 €/mese",
    planNote:
      "Il tuo accesso arriva via email in pochi minuti. Disdici quando vuoi, senza telefonate e senza domande.",
    perguntasTitle: "Solo una domanda che ti stringe il petto?",
    perguntasDesc:
      "Senza abbonamento, senza impegno. Paghi una volta e chiedi subito — di lui, della famiglia, di ciò che non ti fa dormire.",
    pergunta1: "1 domanda — 2,80 €",
    pergunta3: "3 domande — 3,80 € · la più scelta",
    pergunta7: "7 domande — 7,50 € · miglior valore",
    limpezaTitle: "Senti un peso che non è tuo?",
    limpezaDesc:
      "Malocchio, invidia, strade che si chiudono senza spiegazione... ATB prepara la TUA Pulizia Spirituale: cosa è bloccato, da dove viene, e i passi per liberarti. Arriva via email e WhatsApp — tua per sempre.",
    limpezaCta: "✦ Voglio liberarmi di questo — 18 €",
    trustTitle: "Puoi stare tranquilla",
    trust: [
      "Pagamento 100% sicuro (Stripe — lo stesso dei grandi siti)",
      "Accesso nella tua email in pochi minuti — senza complicazioni",
      "Tutto nella tua lingua, con lettere grandi e facili da leggere",
      "Disdici l'abbonamento quando vuoi, senza telefonate né domande",
    ],
    disclaimer:
      "Le letture di ATB TAROT IA hanno scopo di intrattenimento e riflessione. Non sostituiscono una consulenza professionale.",
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

          {/* Imagem mística gerada por IA (decorativa) */}
          <div className="mt-14 mystic-card overflow-hidden border-2 border-[#c9a84c]/30 shadow-gold">
            <Image
              src="/images/hero-tarot.webp"
              alt=""
              width={1536}
              height={1024}
              priority
              className="w-full h-auto"
            />
          </div>
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
      {/* id="assinar" é a âncora histórica usada pelo login e pelos
          cancel_url/erros do roteador de checkout; "produtos" é o alvo
          do CTA do hero. Os dois apontam para esta seção. */}
      <section className="py-20 px-6 scroll-mt-24" id="assinar">
        <div id="produtos" />
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
              <div className="mystic-card flex-1 overflow-hidden">
                <Image
                  src="/images/chat-atb.webp"
                  alt=""
                  width={1024}
                  height={1024}
                  className="w-full h-40 object-cover"
                />
                <div className="p-8 pt-6">
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
              </div>

              {/* Limpeza */}
              <div className="mystic-card flex-1 overflow-hidden">
                <Image
                  src="/images/limpeza.webp"
                  alt=""
                  width={1536}
                  height={1024}
                  className="w-full h-40 object-cover"
                />
                <div className="p-8 pt-6">
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
