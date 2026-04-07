"use client";

import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AssinaturaInativaPage() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center px-6">
      <div className="w-full max-w-lg text-center animate-fade-in">
        <div className="text-6xl mb-6 animate-float">🔒</div>

        <h1 className="font-serif text-3xl gold-gradient-text mb-4">
          Portal Inacessível
        </h1>

        <div className="divider-gold mb-8" />

        <div className="mystic-card p-8 border border-[#8b0000]/30 mb-8">
          <p className="text-[#e8e0d0]/80 leading-relaxed mb-4">
            Minha querida alma, as cartas indicam que sua jornada com o{" "}
            <strong className="text-[#c9a84c]">ATB TAROT IA</strong> está
            pausada no momento.
          </p>
          <p className="text-[#888] text-sm leading-relaxed">
            Para acessar suas leituras místicas e ouvir a voz de ATB,
            você precisa de uma assinatura ativa.
          </p>
        </div>

        <div className="space-y-4">
          <a
            href="https://kiwify.app/atb-tarot-ia"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold w-full block py-4 text-base"
          >
            ✦ Reativar Minha Assinatura — R$29/mês
          </a>

          <div className="flex items-center justify-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className="text-[#c9a84c] hover:underline"
            >
              Ir para o Dashboard
            </Link>
            <span className="text-[#333]">·</span>
            <button
              onClick={handleLogout}
              className="text-[#555] hover:text-[#888] transition-colors"
            >
              Sair da conta
            </button>
          </div>
        </div>

        <p className="text-[#333] text-xs mt-10">
          Se você acabou de assinar e está vendo esta tela, aguarde alguns
          minutos e atualize a página.
        </p>
      </div>
    </main>
  );
}
