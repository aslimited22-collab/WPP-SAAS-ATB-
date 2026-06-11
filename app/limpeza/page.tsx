"use client";

// Funil público da Limpeza Espiritual (R$100 / $19 / €18).
// Coleta os dados ANTES do pagamento, cria o pedido (limpeza_orders) e envia
// o comprador ao roteador de checkout (BR → Kiwify, internacional → Stripe).
// Página multilíngue: detecta o idioma do navegador, com seletor manual.

import { useEffect, useState } from "react";
import Link from "next/link";

type Locale = "pt-BR" | "en" | "es";

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
    price: "R$100 · pagamento único",
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
    submit: "✦ Receber minha Limpeza — R$100",
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
    price: "$19 · one-time payment",
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
    submit: "✦ Receive my Cleansing — $19",
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
    price: "$19 · pago único",
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
    submit: "✦ Recibir mi Limpieza — $19",
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
};

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "pt-BR";
  const lang = (navigator.language ?? "").toLowerCase();
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("es")) return "es";
  return "en";
}

export default function LimpezaPage() {
  const [locale, setLocale] = useState<Locale>("pt-BR");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signo, setSigno] = useState("");
  const [tema, setTema] = useState<string>("energia_pesada");
  const [pergunta, setPergunta] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const t = DICT[locale];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
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
      window.location.href = `/api/checkout/limpeza?order=${data.orderId}`;
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg px-6 py-12">
      <div className="max-w-lg mx-auto animate-fade-in">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="font-serif text-lg">
            <span className="gold-gradient-text font-bold">ATB</span>
            <span className="text-[#e8e0d0] ml-1">TAROT IA</span>
          </Link>
          <div className="flex gap-2 text-xs">
            {(["pt-BR", "en", "es"] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`px-2 py-1 rounded border transition-colors ${
                  locale === l
                    ? "border-[#c9a84c] text-[#c9a84c]"
                    : "border-[#2a2a2a] text-[#b5ab97] hover:text-[#c9a84c]"
                }`}
              >
                {l === "pt-BR" ? "PT" : l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="text-5xl mb-4 animate-float">🕊️</div>
          <h1 className="font-serif text-3xl gold-gradient-text mb-3">
            {t.title}
          </h1>
          <p className="text-[#c2b9a4] text-sm leading-relaxed mb-2">{t.subtitle}</p>
          <p className="text-[#c9a84c] text-sm font-semibold">{t.price}</p>
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
              id="nome"
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
              id="email"
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
              id="phone"
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
              <p className="text-red-400 text-sm">{t.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="btn-gold w-full py-4 text-base rounded-lg"
          >
            {status === "loading" ? t.submitting : t.submit}
          </button>

          <p className="text-[#a39878] text-xs text-center">{t.disclaimer}</p>
        </form>
      </div>
    </main>
  );
}
