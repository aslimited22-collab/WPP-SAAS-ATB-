import Link from "next/link";

export default function ObrigadoPage() {
  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center px-6">
      <div className="w-full max-w-lg text-center">
        <div className="text-6xl mb-6 animate-float">🌟</div>
        <h1 className="font-serif text-4xl gold-gradient-text mb-4">
          Bem-vinda à Jornada
        </h1>
        <div className="divider-gold mb-8" />
        <div className="mystic-card p-8 border border-[#c9a84c]/30 mb-8">
          <p className="text-[#e8e0d0]/80 leading-relaxed mb-4">
            Minha querida alma, as estrelas celebram sua chegada ao{" "}
            <strong className="text-[#c9a84c]">ATB TAROT IA</strong>.
          </p>
          <p className="text-[#888] text-sm leading-relaxed">
            Você receberá um e-mail com o link de acesso ao seu portal. Verifique
            sua caixa de entrada (e o spam, por precaução).
          </p>
        </div>
        <Link
          href="/login"
          className="btn-gold inline-block px-10 py-4 text-base"
        >
          ✦ Acessar Meu Portal
        </Link>
      </div>
    </main>
  );
}
