"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { useUiLocale, LOCALE_LABELS, type UiLocale } from "@/lib/use-locale";

const DICT: Record<
  UiLocale,
  {
    tagline: string;
    sentTitle: string;
    sentText: string;
    sentNotReceived: string;
    sentTryAgain: string;
    formTitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    errorRate: string;
    errorGeneric: string;
    sending: string;
    submit: string;
    footerQuestion: string;
    footerLink: string;
    footerBrand: string;
  }
> = {
  "pt-BR": {
    tagline: "Entre com seu e-mail para acessar seu portal místico",
    sentTitle: "Verifique seu e-mail",
    sentText:
      "Um link mágico foi enviado para o seu e-mail, querida alma. Clique nele para acessar sua conta.",
    sentNotReceived: "Não recebeu? Verifique a pasta de spam ou",
    sentTryAgain: "tente novamente",
    formTitle: "Acessar Portal",
    emailLabel: "E-mail",
    emailPlaceholder: "seu@email.com",
    errorRate: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    errorGeneric: "Erro ao enviar o link de acesso. Tente novamente.",
    sending: "Enviando link mágico...",
    submit: "✦ Enviar Link de Acesso",
    footerQuestion: "Ainda não é assinante?",
    footerLink: "Assine por R$29/mês",
    footerBrand: "ATB TAROT — Portal de Leituras Místicas",
  },
  en: {
    tagline: "Sign in with your email to enter your mystical portal",
    sentTitle: "Check your email",
    sentText:
      "A magic link has been sent to your email, dear soul. Click it to access your account.",
    sentNotReceived: "Didn't get it? Check your spam folder or",
    sentTryAgain: "try again",
    formTitle: "Enter the Portal",
    emailLabel: "Email",
    emailPlaceholder: "your@email.com",
    errorRate: "Too many attempts. Please wait a few minutes and try again.",
    errorGeneric: "We couldn't send your access link. Please try again.",
    sending: "Sending your magic link...",
    submit: "✦ Send Access Link",
    footerQuestion: "Not a subscriber yet?",
    footerLink: "Subscribe for $9/month",
    footerBrand: "ATB TAROT — Mystical Readings Portal",
  },
  es: {
    tagline: "Entra con tu correo para acceder a tu portal místico",
    sentTitle: "Revisa tu correo",
    sentText:
      "Un enlace mágico fue enviado a tu correo, querida alma. Haz clic en él para acceder a tu cuenta.",
    sentNotReceived: "¿No lo recibiste? Revisa la carpeta de spam o",
    sentTryAgain: "inténtalo de nuevo",
    formTitle: "Acceder al Portal",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "tu@correo.com",
    errorRate: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    errorGeneric: "Error al enviar el enlace de acceso. Inténtalo de nuevo.",
    sending: "Enviando enlace mágico...",
    submit: "✦ Enviar Enlace de Acceso",
    footerQuestion: "¿Aún no tienes tu suscripción?",
    footerLink: "Suscríbete por $9/mes",
    footerBrand: "ATB TAROT — Portal de Lecturas Místicas",
  },
  de: {
    tagline: "Melde dich mit deiner E-Mail an und betritt dein mystisches Portal",
    sentTitle: "Schau in dein E-Mail-Postfach",
    sentText:
      "Ein magischer Link wurde an deine E-Mail gesendet, meine liebe Seele. Klicke darauf, um dein Konto zu öffnen.",
    sentNotReceived: "Nichts angekommen? Schau in deinen Spam-Ordner oder",
    sentTryAgain: "versuche es noch einmal",
    formTitle: "Portal betreten",
    emailLabel: "E-Mail",
    emailPlaceholder: "deine@email.de",
    errorRate: "Zu viele Versuche. Bitte warte ein paar Minuten und versuche es erneut.",
    errorGeneric: "Der Zugangslink konnte nicht gesendet werden. Bitte versuche es noch einmal.",
    sending: "Dein magischer Link ist unterwegs...",
    submit: "✦ Zugangslink senden",
    footerQuestion: "Noch kein Abo?",
    footerLink: "Abonniere für 8 €/Monat",
    footerBrand: "ATB TAROT — Portal für mystische Lesungen",
  },
  it: {
    tagline: "Entra con la tua email per accedere al tuo portale mistico",
    sentTitle: "Controlla la tua email",
    sentText:
      "Un link magico è stato inviato alla tua email, anima cara. Cliccaci sopra per accedere al tuo account.",
    sentNotReceived: "Non l'hai ricevuto? Controlla la cartella spam oppure",
    sentTryAgain: "riprova",
    formTitle: "Entra nel Portale",
    emailLabel: "Email",
    emailPlaceholder: "tua@email.it",
    errorRate: "Troppi tentativi. Aspetta qualche minuto e riprova.",
    errorGeneric: "Non siamo riusciti a inviare il link di accesso. Riprova.",
    sending: "Invio del link magico...",
    submit: "✦ Invia Link di Accesso",
    footerQuestion: "Non sei ancora abbonato?",
    footerLink: "Abbonati a 8 €/mese",
    footerBrand: "ATB TAROT — Portale di Letture Mistiche",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useUiLocale();
  const t = DICT[locale];
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  // Verificar se já está logado
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  async function onSubmit(data: LoginInput) {
    setStatus("loading");
    setErrorMsg("");

    const supabase = createBrowserSupabaseClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback`
        : "/api/auth/callback";

    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setStatus("error");
      if (error.message.includes("rate")) {
        setErrorMsg("rate");
      } else {
        setErrorMsg("generic");
      }
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="relative min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center px-6">
      {/* Seletor de idioma */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 sm:gap-3">
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

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <h1 className="font-serif text-3xl">
              <span className="gold-gradient-text font-bold">ATB</span>
              <span className="text-[#e8e0d0] ml-1">TAROT</span>
            </h1>
          </Link>
          <p className="text-[#b5ab97] text-base mt-2">
            {t.tagline}
          </p>
        </div>

        <div className="mystic-card p-8 border border-[#2a2a2a]">
          {status === "sent" ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✉️</div>
              <h2 className="font-serif text-xl text-[#c9a84c] mb-3">
                {t.sentTitle}
              </h2>
              <p className="text-[#c2b9a4] text-base leading-relaxed">
                {t.sentText}
              </p>
              <p className="text-[#aca189] text-base mt-4">
                {t.sentNotReceived}{" "}
                <button
                  className="text-[#c9a84c] underline"
                  onClick={() => setStatus("idle")}
                >
                  {t.sentTryAgain}
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-xl text-[#c9a84c] mb-6 text-center">
                {t.formTitle}
              </h2>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="mb-5">
                  <label
                    htmlFor="email"
                    className="block text-base text-[#c2b9a4] mb-2"
                  >
                    {t.emailLabel}
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t.emailPlaceholder}
                    className="input-mystic"
                    {...register("email")}
                    disabled={status === "loading"}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-base mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {status === "error" && (
                  <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-base">
                      {errorMsg === "rate" ? t.errorRate : t.errorGeneric}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="btn-gold w-full py-3 text-lg"
                >
                  {status === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                      {t.sending}
                    </span>
                  ) : (
                    t.submit
                  )}
                </button>
              </form>

              <p className="text-center text-[#aca189] text-base mt-6">
                {t.footerQuestion}{" "}
                <Link href="/#assinar" className="text-[#c9a84c] hover:underline">
                  {t.footerLink}
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-[#9a9077] text-sm mt-6">
          {t.footerBrand}
        </p>
      </div>
    </main>
  );
}
