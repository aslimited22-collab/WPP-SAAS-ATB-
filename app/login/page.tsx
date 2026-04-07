"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { loginSchema, type LoginInput } from "@/lib/validators";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
        setErrorMsg("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setErrorMsg("Erro ao enviar o link de acesso. Tente novamente.");
      }
      return;
    }

    setStatus("sent");
  }

  const nextPath = searchParams.get("next") ?? "/dashboard";

  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <h1 className="font-serif text-3xl">
              <span className="gold-gradient-text font-bold">ATB</span>
              <span className="text-[#e8e0d0] ml-1">TAROT IA</span>
            </h1>
          </Link>
          <p className="text-[#666] text-sm mt-2">
            Entre com seu e-mail para acessar seu portal místico
          </p>
        </div>

        <div className="mystic-card p-8 border border-[#2a2a2a]">
          {status === "sent" ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✉️</div>
              <h2 className="font-serif text-xl text-[#c9a84c] mb-3">
                Verifique seu e-mail
              </h2>
              <p className="text-[#888] text-sm leading-relaxed">
                Um link mágico foi enviado para o seu e-mail. Clique nele para
                acessar sua conta.
              </p>
              <p className="text-[#555] text-xs mt-4">
                Não recebeu? Verifique a pasta de spam ou{" "}
                <button
                  className="text-[#c9a84c] underline"
                  onClick={() => setStatus("idle")}
                >
                  tente novamente
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-xl text-[#c9a84c] mb-6 text-center">
                Acessar Portal
              </h2>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="mb-5">
                  <label
                    htmlFor="email"
                    className="block text-sm text-[#888] mb-2"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    className="input-mystic"
                    {...register("email")}
                    disabled={status === "loading"}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {status === "error" && (
                  <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{errorMsg}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="btn-gold w-full py-3 text-sm"
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
                      Enviando link mágico...
                    </span>
                  ) : (
                    "✦ Enviar Link de Acesso"
                  )}
                </button>
              </form>

              <p className="text-center text-[#555] text-xs mt-6">
                Ainda não é assinante?{" "}
                <Link href="/#assinar" className="text-[#c9a84c] hover:underline">
                  Assine por R$29/mês
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-[#333] text-xs mt-6">
          ATB TAROT IA — Portal de Leituras Místicas
        </p>
      </div>
    </main>
  );
}
