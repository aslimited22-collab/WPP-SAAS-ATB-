// Página de obrigado pós-compra — usada pelos dois checkouts:
//   Kiwify (BR): URL de obrigado configurada no produto → sempre pt-BR
//   Stripe (intl): success_url inclui ?lang=<locale do comprador>
import Link from "next/link";

type Locale = "pt-BR" | "en" | "es" | "de" | "it";

const COPY: Record<
  Locale,
  { title: string; body1: string; body2: string; cta: string }
> = {
  "pt-BR": {
    title: "Bem-vinda à Jornada",
    body1: "Minha querida alma, as estrelas celebram sua chegada ao",
    body2:
      "Você receberá um e-mail com o link de acesso ao seu portal. Verifique sua caixa de entrada (e o spam, por precaução).",
    cta: "✦ Acessar Meu Portal",
  },
  en: {
    title: "Welcome to the Journey",
    body1: "Dear soul, the stars celebrate your arrival at",
    body2:
      "You will receive an email with your access link. Please check your inbox (and the spam folder, just in case).",
    cta: "✦ Access My Portal",
  },
  es: {
    title: "Bienvenida al Viaje",
    body1: "Querida alma, las estrellas celebran tu llegada a",
    body2:
      "Recibirás un correo con el enlace de acceso a tu portal. Revisa tu bandeja de entrada (y el spam, por si acaso).",
    cta: "✦ Acceder a Mi Portal",
  },
  de: {
    title: "Willkommen auf deiner Reise",
    body1: "Meine liebe Seele, die Sterne feiern deine Ankunft bei",
    body2:
      "Du erhältst eine E-Mail mit dem Zugangslink zu deinem Portal. Schau in deinen Posteingang (und sicherheitshalber auch in den Spam-Ordner).",
    cta: "✦ Mein Portal öffnen",
  },
  it: {
    title: "Benvenuta nel Viaggio",
    body1: "Anima cara, le stelle celebrano il tuo arrivo ad",
    body2:
      "Riceverai un'e-mail con il link di accesso al tuo portale. Controlla la tua casella di posta (e anche lo spam, per sicurezza).",
    cta: "✦ Accedi al Mio Portale",
  },
};

function normalize(lang: string | undefined): Locale {
  const lc = (lang ?? "").toLowerCase();
  if (lc.startsWith("en")) return "en";
  if (lc.startsWith("es")) return "es";
  if (lc.startsWith("de")) return "de";
  if (lc.startsWith("it")) return "it";
  return "pt-BR";
}

export default async function ObrigadoPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const locale = normalize(lang);
  const t = COPY[locale];

  return (
    // lang no <main>: o layout raiz fixa html lang="pt-BR"; esta página é
    // server-rendered no idioma do comprador (?lang= do success_url).
    <main
      lang={locale}
      className="min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center px-6"
    >
      <div className="w-full max-w-lg text-center">
        <div className="text-6xl mb-6 animate-float">🌟</div>
        <h1 className="font-serif text-4xl gold-gradient-text mb-4">
          {t.title}
        </h1>
        <div className="divider-gold mb-8" />
        <div className="mystic-card p-8 border border-[#c9a84c]/30 mb-8">
          <p className="text-[#e8e0d0]/80 leading-relaxed mb-4">
            {t.body1}{" "}
            <strong className="text-[#c9a84c]">ATB TAROT IA</strong>.
          </p>
          <p className="text-[#c2b9a4] text-sm leading-relaxed">{t.body2}</p>
        </div>
        <Link
          href="/login"
          className="btn-gold inline-block px-10 py-4 text-base"
        >
          {t.cta}
        </Link>
      </div>
    </main>
  );
}
