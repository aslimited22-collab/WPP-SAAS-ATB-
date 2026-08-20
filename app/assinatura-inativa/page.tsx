"use client";

import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useUiLocale, LOCALE_LABELS, type UiLocale } from "@/lib/use-locale";

const DICT: Record<
  UiLocale,
  {
    title: string;
    msg1Before: string;
    brand: string;
    msg1After: string;
    msg2: string;
    reactivate: string;
    goDashboard: string;
    logout: string;
    justSubscribed: string;
  }
> = {
  "pt-BR": {
    title: "Portal Inacessível",
    msg1Before: "Minha querida alma, as cartas indicam que sua jornada com o ",
    brand: "ATB TAROT",
    msg1After: " está pausada no momento.",
    msg2: "Escolha um trabalho espiritual com a ATB pra continuar sua jornada — suas conversas anteriores continuam guardadas no seu portal.",
    reactivate: "✦ Ver os trabalhos da ATB",
    goDashboard: "Ir para o Dashboard",
    logout: "Sair da conta",
    justSubscribed:
      "Se você acabou de assinar e está vendo esta tela, aguarde alguns minutos e atualize a página.",
  },
  en: {
    title: "The Portal Is Locked",
    msg1Before: "Dear soul, the cards reveal that your journey with ",
    brand: "ATB TAROT",
    msg1After: " is paused for now.",
    msg2: "Choose a spiritual work with ATB to continue your journey — your previous conversations remain saved in your portal.",
    reactivate: "✦ See ATB's spiritual work",
    goDashboard: "Go to Dashboard",
    logout: "Sign out",
    justSubscribed:
      "If you just subscribed and are seeing this screen, please wait a few minutes and refresh the page.",
  },
  es: {
    title: "Portal Inaccesible",
    msg1Before: "Querida alma, las cartas indican que tu camino con ",
    brand: "ATB TAROT",
    msg1After: " está en pausa por el momento.",
    msg2: "Elige un trabajo espiritual con ATB para continuar tu camino — tus conversaciones anteriores siguen guardadas en tu portal.",
    reactivate: "✦ Ver los trabajos de ATB",
    goDashboard: "Ir al Panel",
    logout: "Cerrar sesión",
    justSubscribed:
      "Si acabas de suscribirte y estás viendo esta pantalla, espera unos minutos y actualiza la página.",
  },
  de: {
    title: "Das Portal ist verschlossen",
    msg1Before: "Meine liebe Seele, die Karten zeigen, dass deine Reise mit ",
    brand: "ATB TAROT",
    msg1After: " gerade pausiert.",
    msg2: "Wähle eine spirituelle Arbeit mit ATB, um deinen Weg fortzusetzen — deine bisherigen Gespräche bleiben in deinem Portal gespeichert.",
    reactivate: "✦ Die Arbeiten von ATB ansehen",
    goDashboard: "Zum Dashboard",
    logout: "Abmelden",
    justSubscribed:
      "Wenn du gerade erst abonniert hast und diese Seite siehst, warte bitte ein paar Minuten und lade die Seite neu.",
  },
  it: {
    title: "Il Portale è Chiuso",
    msg1Before: "Anima cara, le carte rivelano che il tuo cammino con ",
    brand: "ATB TAROT",
    msg1After: " è in pausa per ora.",
    msg2: "Scegli un lavoro spirituale con ATB per continuare il tuo cammino — le tue conversazioni precedenti restano salvate nel tuo portale.",
    reactivate: "✦ Scopri i lavori di ATB",
    goDashboard: "Vai alla Dashboard",
    logout: "Esci",
    justSubscribed:
      "Se ti sei appena abbonato e vedi questa schermata, aspetta qualche minuto e aggiorna la pagina.",
  },
};

export default function AssinaturaInativaPage() {
  const router = useRouter();
  const [locale, setLocale] = useUiLocale();
  const t = DICT[locale];

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center px-6">
      <div className="w-full max-w-lg text-center animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
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
        </div>

        <div className="text-6xl mb-6 animate-float">🔒</div>

        <h1 className="font-serif text-3xl gold-gradient-text mb-4">
          {t.title}
        </h1>

        <div className="divider-gold mb-8" />

        <div className="mystic-card p-8 border border-[#8b0000]/30 mb-8">
          <p className="text-[#e8e0d0]/80 text-base leading-relaxed mb-4">
            {t.msg1Before}
            <strong className="text-[#c9a84c]">{t.brand}</strong>
            {t.msg1After}
          </p>
          <p className="text-[#c2b9a4] text-base leading-relaxed">{t.msg2}</p>
        </div>

        <div className="space-y-4">
          {/* Apontava pra /api/checkout/basic — assinatura DESCONTINUADA: o
              roteador recusa e devolve pra home, virando beco sem saída.
              Manda pros trabalhos que estão realmente à venda. */}
          <Link href="/" className="btn-gold w-full block py-4 text-lg text-center">
            {t.reactivate}
          </Link>

          <div className="flex items-center justify-center gap-4 text-base">
            <Link
              href="/dashboard"
              className="text-[#c9a84c] hover:underline"
            >
              {t.goDashboard}
            </Link>
            <span className="text-[#9a9077]">·</span>
            <button
              onClick={handleLogout}
              className="text-[#aca189] hover:text-[#c2b9a4] transition-colors"
            >
              {t.logout}
            </button>
          </div>
        </div>

        <p className="text-[#9a9077] text-sm mt-10">{t.justSubscribed}</p>
      </div>
    </main>
  );
}
