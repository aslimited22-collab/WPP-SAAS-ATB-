"use client";

// Formulário de personalização da Limpeza — aparece para quem comprou DIRETO
// na Kiwify (sem passar pelo funil /limpeza) e por isso não informou tema,
// situação nem signo. Ao enviar, a leitura é regerada personalizada.
//
// Público 60+: rótulos grandes, poucos campos, instrução simples.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/locale";
import {
  LIMPEZA_THEMES,
  LIMPEZA_SIGNS,
  THEME_LABELS,
  SIGN_LABELS,
} from "@/lib/limpeza";

const COPY: Record<
  AppLocale,
  {
    titulo: string;
    intro: string;
    tema: string;
    signo: string;
    signoNenhum: string;
    situacao: string;
    situacaoDica: string;
    placeholder: string;
    enviar: string;
    enviando: string;
    erroGenerico: string;
  }
> = {
  "pt-BR": {
    titulo: "Deixe sua limpeza ainda mais sua",
    intro:
      "Me conte o que você está vivendo. Com isso eu preparo uma limpeza feita para o seu momento — e a sua leitura aqui é atualizada.",
    tema: "O que precisa ser limpo?",
    signo: "Seu signo (opcional)",
    signoNenhum: "Prefiro não informar",
    situacao: "Conte a sua situação",
    situacaoDica: "Escreva com as suas palavras, sem pressa.",
    placeholder: "O que você está sentindo ou vivendo...",
    enviar: "✦ Preparar minha limpeza personalizada",
    enviando: "Preparando com carinho... pode levar até um minuto",
    erroGenerico: "Não consegui agora. Tente novamente em instantes.",
  },
  en: {
    titulo: "Make your cleansing even more yours",
    intro:
      "Tell me what you are going through. With that I prepare a cleansing made for your moment — and your reading here is updated.",
    tema: "What needs to be cleansed?",
    signo: "Your zodiac sign (optional)",
    signoNenhum: "Prefer not to say",
    situacao: "Tell me your situation",
    situacaoDica: "Write in your own words, take your time.",
    placeholder: "What you are feeling or going through...",
    enviar: "✦ Prepare my personalized cleansing",
    enviando: "Preparing with care... this can take up to a minute",
    erroGenerico: "It didn't work now. Please try again in a moment.",
  },
  es: {
    titulo: "Haz que tu limpieza sea aún más tuya",
    intro:
      "Cuéntame lo que estás viviendo. Con eso preparo una limpieza hecha para tu momento — y tu lectura aquí se actualiza.",
    tema: "¿Qué necesita ser limpiado?",
    signo: "Tu signo (opcional)",
    signoNenhum: "Prefiero no decirlo",
    situacao: "Cuéntame tu situación",
    situacaoDica: "Escribe con tus palabras, sin prisa.",
    placeholder: "Lo que estás sintiendo o viviendo...",
    enviar: "✦ Preparar mi limpieza personalizada",
    enviando: "Preparando con cariño... puede tardar un minuto",
    erroGenerico: "No pude ahora. Inténtalo de nuevo en un momento.",
  },
  de: {
    titulo: "Mach deine Reinigung noch persönlicher",
    intro:
      "Erzähl mir, was du gerade durchmachst. Damit bereite ich eine Reinigung für deinen Moment vor — und deine Lesung hier wird aktualisiert.",
    tema: "Was soll gereinigt werden?",
    signo: "Dein Sternzeichen (optional)",
    signoNenhum: "Lieber nicht sagen",
    situacao: "Erzähl mir deine Situation",
    situacaoDica: "Schreibe mit deinen eigenen Worten, in Ruhe.",
    placeholder: "Was du fühlst oder durchmachst...",
    enviar: "✦ Meine persönliche Reinigung vorbereiten",
    enviando: "Wird mit Sorgfalt vorbereitet... kann eine Minute dauern",
    erroGenerico: "Es hat gerade nicht geklappt. Bitte versuche es gleich erneut.",
  },
  it: {
    titulo: "Rendi la tua pulizia ancora più tua",
    intro:
      "Raccontami cosa stai vivendo. Con questo preparo una pulizia fatta per il tuo momento — e la tua lettura qui viene aggiornata.",
    tema: "Cosa deve essere purificato?",
    signo: "Il tuo segno (opzionale)",
    signoNenhum: "Preferisco non dirlo",
    situacao: "Raccontami la tua situazione",
    situacaoDica: "Scrivi con parole tue, con calma.",
    placeholder: "Quello che stai sentendo o vivendo...",
    enviar: "✦ Prepara la mia pulizia personalizzata",
    enviando: "Sto preparando con cura... può volerci un minuto",
    erroGenerico: "Non ci sono riuscita ora. Riprova tra un istante.",
  },
};

export default function PersonalizarForm({
  orderId,
  locale,
}: {
  orderId: string;
  locale: AppLocale;
}) {
  const router = useRouter();
  const t = COPY[locale];
  const [tema, setTema] = useState<string>("");
  const [signo, setSigno] = useState<string>("");
  const [pergunta, setPergunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/limpeza/personalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          tema,
          pergunta,
          signo: signo || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? t.erroGenerico);
        return;
      }
      router.refresh();
    } catch {
      setErro(t.erroGenerico);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mystic-card p-8 border border-[#c9a84c]/30 mb-8"
      noValidate
    >
      <h2 className="font-serif text-2xl text-[#c9a84c] mb-3">{t.titulo}</h2>
      <p className="text-[#c2b9a4] text-lg leading-relaxed mb-7">{t.intro}</p>

      <div className="mb-6">
        <label htmlFor="tema" className="block text-[#e8e0d0] text-lg mb-2">
          {t.tema}
        </label>
        <select
          id="tema"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          className="input-mystic text-lg"
          required
        >
          <option value="">—</option>
          {LIMPEZA_THEMES.map((k) => (
            <option key={k} value={k}>
              {THEME_LABELS[locale][k]}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="situacao" className="block text-[#e8e0d0] text-lg mb-2">
          {t.situacao}
        </label>
        <p className="text-[#9a8f78] text-base mb-2">{t.situacaoDica}</p>
        <textarea
          id="situacao"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value.slice(0, 600))}
          placeholder={t.placeholder}
          className="input-mystic text-lg h-36 resize-none"
          required
        />
        <p className="text-[#555] text-sm mt-1 text-right">
          {pergunta.length}/600
        </p>
      </div>

      <div className="mb-7">
        <label htmlFor="signo" className="block text-[#e8e0d0] text-lg mb-2">
          {t.signo}
        </label>
        <select
          id="signo"
          value={signo}
          onChange={(e) => setSigno(e.target.value)}
          className="input-mystic text-lg"
        >
          <option value="">{t.signoNenhum}</option>
          {LIMPEZA_SIGNS.map((k) => (
            <option key={k} value={k}>
              {SIGN_LABELS[locale][k]}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 mb-5">
          <p className="text-red-400 text-base">{erro}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="btn-gold w-full py-5 text-lg"
      >
        {enviando ? t.enviando : t.enviar}
      </button>
    </form>
  );
}
