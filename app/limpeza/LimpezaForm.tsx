"use client";

// Funil público da Limpeza Espiritual (R$100 / $19 / €18).
// Coleta os dados ANTES do pagamento, cria o pedido (limpeza_orders) e envia
// o comprador ao roteador de checkout (BR → Kiwify, internacional → Stripe).
// Página multilíngue: detecta o idioma do navegador, com seletor manual.

import { formatProductPrice, type Currency } from "@/lib/pricing";
import { StoreHeader } from "@/app/components/StoreHeader";
import { useState } from "react";
import Image from "next/image";
import { useUiLocale, type UiLocale } from "@/lib/use-locale";
import { fireBeginCheckout } from "@/lib/gtag";

type Locale = UiLocale;

const TEMAS = [
  "energia_pesada",
  "inveja",
  "amor_travado",
  "caminhos_fechados",
  "separacao",
  "protecao_espiritual",
  "dinheiro_trabalho",
  "tristeza_coracao",
] as const;

const SIGNOS = [
  "aries", "touro", "gemeos", "cancer", "leao", "virgem",
  "libra", "escorpiao", "sagitario", "capricornio", "aquario", "peixes",
] as const;

const DICT: Record<Locale, {
  title: string;
  subtitle: string;
  price: string;
  nome: string;
  email: string;
  phone: string;
  phoneHint: string;
  signo: string;
  signoNone: string;
  tema: string;
  pergunta: string;
  perguntaPlaceholder: string;
  submit: string;
  submitting: string;
  error: string;
  disclaimer: string;
  temas: Record<(typeof TEMAS)[number], string>;
  signos: Record<(typeof SIGNOS)[number], string>;
}> = {
  "pt-BR": {
    title: "Limpeza Espiritual Personalizada",
    subtitle:
      "A ATB prepara uma limpeza espiritual única para você: leitura do seu momento, mensagem de descarrego, proteção e passos práticos. Entrega por e-mail e WhatsApp.",
    price: "pagamento único",
    nome: "Seu nome",
    email: "Seu e-mail",
    phone: "WhatsApp (opcional)",
    phoneHint: "Com código do país, ex.: +55 11 99999-9999",
    signo: "Seu signo (opcional)",
    signoNone: "Prefiro não informar",
    tema: "O que precisa ser limpo?",
    pergunta: "Conte sua situação (opcional)",
    perguntaPlaceholder:
      "Escreva com suas palavras o que você está sentindo ou vivendo...",
    submit: "Receber minha Limpeza",
    submitting: "Preparando seu pedido...",
    error: "Não foi possível criar seu pedido. Tente novamente.",
    disclaimer:
      "Conteúdo espiritual, simbólico e de entretenimento. Não substitui ajuda profissional.",
    temas: {
      energia_pesada: "Energia pesada",
      inveja: "Inveja",
      amor_travado: "Amor travado",
      caminhos_fechados: "Caminhos fechados",
      separacao: "Separação",
      protecao_espiritual: "Proteção espiritual",
      dinheiro_trabalho: "Dinheiro e trabalho",
      tristeza_coracao: "Tristeza no coração",
    },
    signos: {
      aries: "Áries", touro: "Touro", gemeos: "Gêmeos", cancer: "Câncer",
      leao: "Leão", virgem: "Virgem", libra: "Libra", escorpiao: "Escorpião",
      sagitario: "Sagitário", capricornio: "Capricórnio", aquario: "Aquário", peixes: "Peixes",
    },
  },
  en: {
    title: "Personalized Spiritual Cleansing",
    subtitle:
      "ATB prepares a unique spiritual cleansing for you: a reading of your moment, a cleansing message, protection and practical steps. Delivered by email and WhatsApp.",
    price: "one-time payment",
    nome: "Your name",
    email: "Your email",
    phone: "WhatsApp (optional)",
    phoneHint: "With country code, e.g. +1 555 123 4567",
    signo: "Your zodiac sign (optional)",
    signoNone: "Prefer not to say",
    tema: "What needs to be cleansed?",
    pergunta: "Tell us your situation (optional)",
    perguntaPlaceholder:
      "Write in your own words what you are feeling or going through...",
    submit: "Receive my Cleansing",
    submitting: "Preparing your order...",
    error: "Could not create your order. Please try again.",
    disclaimer:
      "Spiritual, symbolic, entertainment content. Not a substitute for professional help.",
    temas: {
      energia_pesada: "Heavy energy",
      inveja: "Envy",
      amor_travado: "Blocked love",
      caminhos_fechados: "Closed paths",
      separacao: "Separation",
      protecao_espiritual: "Spiritual protection",
      dinheiro_trabalho: "Money and work",
      tristeza_coracao: "Sadness in the heart",
    },
    signos: {
      aries: "Aries", touro: "Taurus", gemeos: "Gemini", cancer: "Cancer",
      leao: "Leo", virgem: "Virgo", libra: "Libra", escorpiao: "Scorpio",
      sagitario: "Sagittarius", capricornio: "Capricorn", aquario: "Aquarius", peixes: "Pisces",
    },
  },
  es: {
    title: "Limpieza Espiritual Personalizada",
    subtitle:
      "ATB prepara una limpieza espiritual única para ti: lectura de tu momento, mensaje de limpieza, protección y pasos prácticos. Entrega por correo y WhatsApp.",
    price: "pago único",
    nome: "Tu nombre",
    email: "Tu correo electrónico",
    phone: "WhatsApp (opcional)",
    phoneHint: "Con código de país, ej.: +34 600 000 000",
    signo: "Tu signo (opcional)",
    signoNone: "Prefiero no decirlo",
    tema: "¿Qué necesita ser limpiado?",
    pergunta: "Cuéntanos tu situación (opcional)",
    perguntaPlaceholder:
      "Escribe con tus palabras lo que estás sintiendo o viviendo...",
    submit: "Recibir mi Limpieza",
    submitting: "Preparando tu pedido...",
    error: "No se pudo crear tu pedido. Inténtalo de nuevo.",
    disclaimer:
      "Contenido espiritual, simbólico y de entretenimiento. No sustituye la ayuda profesional.",
    temas: {
      energia_pesada: "Energía pesada",
      inveja: "Envidia",
      amor_travado: "Amor bloqueado",
      caminhos_fechados: "Caminos cerrados",
      separacao: "Separación",
      protecao_espiritual: "Protección espiritual",
      dinheiro_trabalho: "Dinero y trabajo",
      tristeza_coracao: "Tristeza en el corazón",
    },
    signos: {
      aries: "Aries", touro: "Tauro", gemeos: "Géminis", cancer: "Cáncer",
      leao: "Leo", virgem: "Virgo", libra: "Libra", escorpiao: "Escorpio",
      sagitario: "Sagitario", capricornio: "Capricornio", aquario: "Acuario", peixes: "Piscis",
    },
  },
  de: {
    title: "Persönliche spirituelle Reinigung",
    subtitle:
      "ATB bereitet eine einzigartige spirituelle Reinigung für dich vor: eine Deutung deines Moments, eine reinigende Botschaft, Schutz und praktische Schritte. Zustellung per E-Mail und WhatsApp.",
    price: "einmalige Zahlung",
    nome: "Dein Name",
    email: "Deine E-Mail",
    phone: "WhatsApp (optional)",
    phoneHint: "Mit Ländervorwahl, z. B. +49 151 23456789",
    signo: "Dein Sternzeichen (optional)",
    signoNone: "Möchte ich nicht angeben",
    tema: "Was soll gereinigt werden?",
    pergunta: "Erzähle uns deine Situation (optional)",
    perguntaPlaceholder:
      "Schreibe mit deinen eigenen Worten, was du gerade fühlst oder erlebst...",
    submit: "Meine Reinigung erhalten",
    submitting: "Deine Bestellung wird vorbereitet...",
    error: "Deine Bestellung konnte nicht erstellt werden. Bitte versuche es noch einmal.",
    disclaimer:
      "Spiritueller, symbolischer Unterhaltungsinhalt. Kein Ersatz für professionelle Hilfe.",
    temas: {
      energia_pesada: "Schwere Energie",
      inveja: "Neid",
      amor_travado: "Blockierte Liebe",
      caminhos_fechados: "Verschlossene Wege",
      separacao: "Trennung",
      protecao_espiritual: "Spiritueller Schutz",
      dinheiro_trabalho: "Geld und Arbeit",
      tristeza_coracao: "Trauer im Herzen",
    },
    signos: {
      aries: "Widder", touro: "Stier", gemeos: "Zwillinge", cancer: "Krebs",
      leao: "Löwe", virgem: "Jungfrau", libra: "Waage", escorpiao: "Skorpion",
      sagitario: "Schütze", capricornio: "Steinbock", aquario: "Wassermann", peixes: "Fische",
    },
  },
  it: {
    title: "Pulizia Spirituale Personalizzata",
    subtitle:
      "ATB prepara una pulizia spirituale unica per te: una lettura del tuo momento, un messaggio di purificazione, protezione e passi pratici. Consegna via email e WhatsApp.",
    price: "pagamento unico",
    nome: "Il tuo nome",
    email: "La tua email",
    phone: "WhatsApp (facoltativo)",
    phoneHint: "Con prefisso internazionale, es.: +39 333 1234567",
    signo: "Il tuo segno (facoltativo)",
    signoNone: "Preferisco non dirlo",
    tema: "Cosa deve essere purificato?",
    pergunta: "Raccontaci la tua situazione (facoltativo)",
    perguntaPlaceholder:
      "Scrivi con parole tue ciò che stai sentendo o vivendo...",
    submit: "Ricevere la mia Pulizia",
    submitting: "Stiamo preparando il tuo ordine...",
    error: "Non è stato possibile creare il tuo ordine. Riprova.",
    disclaimer:
      "Contenuto spirituale, simbolico e di intrattenimento. Non sostituisce l'aiuto professionale.",
    temas: {
      energia_pesada: "Energia pesante",
      inveja: "Invidia",
      amor_travado: "Amore bloccato",
      caminhos_fechados: "Strade chiuse",
      separacao: "Separazione",
      protecao_espiritual: "Protezione spirituale",
      dinheiro_trabalho: "Denaro e lavoro",
      tristeza_coracao: "Tristezza nel cuore",
    },
    signos: {
      aries: "Ariete", touro: "Toro", gemeos: "Gemelli", cancer: "Cancro",
      leao: "Leone", virgem: "Vergine", libra: "Bilancia", escorpiao: "Scorpione",
      sagitario: "Sagittario", capricornio: "Capricorno", aquario: "Acquario", peixes: "Pesci",
    },
  },
};

export default function LimpezaForm({ currency, initialLocale }: { currency: Currency; initialLocale: Locale }) {
  // Mesmo idioma escolhido nas outras páginas (persistido em localStorage
  // e refletido em html lang pelo hook compartilhado).
  const [locale, setLocale] = useUiLocale(initialLocale);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signo, setSigno] = useState("");
  const [tema, setTema] = useState<string>("energia_pesada");
  const [pergunta, setPergunta] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const t = DICT[locale];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    // Registra o "Iniciar finalização de compra" no Google Ads no momento do
    // clique. O POST abaixo leva centenas de ms, então o evento sai antes do
    // redirect — sem corrida e sem atrasar o comprador.
    fireBeginCheckout();
    try {
      const res = await fetch("/api/limpeza/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          phone: phone || undefined,
          signo: signo || undefined,
          tema,
          pergunta,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.orderId) {
        setStatus("error");
        return;
      }
      window.location.href = `/api/checkout/limpeza?order=${data.orderId}&lang=${locale}`;
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="atb-shop atb-funnel" lang={locale}>
      <StoreHeader locale={locale} onLocale={setLocale} />
      <main className="atb-form-layout atb-wrap">
        <div className="text-center mb-8">
          <div className="mystic-card overflow-hidden border border-[#c9a84c]/30 mb-6">
            <Image
              src="/images/limpeza.webp"
              alt=""
              width={1536}
              height={1024}
              priority
              className="w-full h-44 object-cover"
            />
          </div>

          <h1 className="font-serif text-3xl gold-gradient-text mb-3">
            {t.title}
          </h1>
          <p className="text-[#c2b9a4] text-sm leading-relaxed mb-2">{t.subtitle}</p>
          <p className="text-[#c9a84c] text-sm font-semibold">{formatProductPrice("limpeza", currency, locale)} · {t.price}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mystic-card p-8 border border-[#c9a84c]/30 space-y-5"
        >
          <div>
            <label htmlFor="nome" className="block text-sm text-[#c2b9a4] mb-2">
              {t.nome}
            </label>
            <input
              id="nome" autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              className="input-mystic"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-[#c2b9a4] mb-2">
              {t.email}
            </label>
            <input
              id="email" autoComplete="email"
              type="email"
              required
              maxLength={255}
              className="input-mystic"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm text-[#c2b9a4] mb-2">
              {t.phone}
            </label>
            <input
              id="phone" autoComplete="tel"
              type="tel"
              maxLength={20}
              placeholder={t.phoneHint}
              className="input-mystic"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="signo" className="block text-sm text-[#c2b9a4] mb-2">
              {t.signo}
            </label>
            <select
              id="signo"
              className="input-mystic"
              value={signo}
              onChange={(e) => setSigno(e.target.value)}
            >
              <option value="">{t.signoNone}</option>
              {SIGNOS.map((s) => (
                <option key={s} value={s}>
                  {t.signos[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tema" className="block text-sm text-[#c2b9a4] mb-2">
              {t.tema}
            </label>
            <select
              id="tema"
              required
              className="input-mystic"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
            >
              {TEMAS.map((tm) => (
                <option key={tm} value={tm}>
                  {t.temas[tm]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pergunta" className="block text-sm text-[#c2b9a4] mb-2">
              {t.pergunta}
            </label>
            <textarea
              id="pergunta"
              rows={4}
              maxLength={600}
              placeholder={t.perguntaPlaceholder}
              className="input-mystic resize-none"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
            />
          </div>

          {status === "error" && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3">
              <p role="alert" className="text-red-400 text-sm">{t.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="btn-gold w-full py-4 text-base rounded-lg"
          >
            {status === "loading" ? t.submitting : `${t.submit} · ${formatProductPrice("limpeza", currency, locale)}`}
          </button>

          <p className="text-[#a39878] text-xs text-center">{t.disclaimer}</p>
        </form>
      </main>
    </div>
  );
}
