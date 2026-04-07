"use client";

import Link from "next/link";

const TESTIMONIALS = [
  {
    nome: "Ana C.",
    signo: "Escorpião",
    texto:
      "A leitura do ATB foi incrivelmente precisa. As cartas descreveram exatamente o que estou vivendo agora. Fiquei arrepiada!",
  },
  {
    nome: "Mariana S.",
    signo: "Leão",
    texto:
      "Recebi minha leitura no WhatsApp em minutos. ATB tem um dom especial, cada palavra tocou fundo na minha alma.",
  },
  {
    nome: "Fernanda R.",
    signo: "Peixes",
    texto:
      "Já são 3 meses assinando e cada leitura me surpreende mais do que a anterior. Vale cada centavo!",
  },
];

const CARDS_PREVIEW = [
  { emoji: "🌙", name: "A Lua", meaning: "Intuição & Mistérios" },
  { emoji: "⭐", name: "A Estrela", meaning: "Esperança & Renovação" },
  { emoji: "☀️", name: "O Sol", meaning: "Abundância & Clareza" },
  { emoji: "🔮", name: "A Sacerdotisa", meaning: "Sabedoria Oculta" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg">
      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#2a2a2a]">
        <div className="font-serif text-xl">
          <span className="gold-gradient-text font-bold">ATB</span>
          <span className="text-[#e8e0d0] ml-1">TAROT IA</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-[#888] hover:text-[#c9a84c] text-sm transition-colors"
          >
            Entrar
          </Link>
          <a
            href="#assinar"
            className="btn-gold text-sm px-4 py-2 rounded-lg font-semibold"
          >
            Assinar Agora
          </a>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center min-h-screen text-center px-6 pt-20">
        <div className="animate-fade-in max-w-3xl mx-auto">
          <p className="text-[#c9a84c] text-sm font-medium tracking-widest uppercase mb-6 opacity-80">
            ✦ O Oráculo que Fala a Sua Língua ✦
          </p>
          <h1 className="text-5xl md:text-7xl font-serif mb-6 leading-tight">
            <span className="gold-gradient-text">ATB TAROT IA</span>
          </h1>
          <p className="text-xl md:text-2xl text-[#e8e0d0]/80 font-serif italic mb-4">
            Leituras místicas e personalizadas
          </p>
          <p className="text-base text-[#888] mb-10 max-w-xl mx-auto leading-relaxed">
            ATB interpreta as cartas do destino especialmente para você e entrega
            sua leitura diretamente no WhatsApp — em minutos, com profundidade
            e precisão únicas.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="#assinar" className="btn-gold text-base px-8 py-4 rounded-lg w-full sm:w-auto">
              ✦ Começar Minha Jornada
            </a>
            <a
              href="#como-funciona"
              className="text-[#c9a84c] border border-[#c9a84c]/30 px-8 py-4 rounded-lg text-base hover:border-[#c9a84c] transition-colors w-full sm:w-auto text-center"
            >
              Como funciona?
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-[#666]">
            <div className="text-center">
              <div className="text-[#c9a84c] text-2xl font-bold">5</div>
              <div>leituras/mês</div>
            </div>
            <div className="w-px h-10 bg-[#2a2a2a]" />
            <div className="text-center">
              <div className="text-[#c9a84c] text-2xl font-bold">R$29</div>
              <div>por mês</div>
            </div>
            <div className="w-px h-10 bg-[#2a2a2a]" />
            <div className="text-center">
              <div className="text-[#c9a84c] text-2xl font-bold">WhatsApp</div>
              <div>entrega direta</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CARTAS ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6" id="como-funciona">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif gold-gradient-text mb-4">
              As Cartas Falam por Você
            </h2>
            <div className="divider-gold mb-4" />
            <p className="text-[#888] max-w-xl mx-auto">
              ATB analisa sua data de nascimento, signo e momento de vida para
              selecionar as cartas que têm uma mensagem especial para você hoje.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CARDS_PREVIEW.map((card) => (
              <div
                key={card.name}
                className="mystic-card p-6 text-center animate-float"
                style={{ animationDelay: `${CARDS_PREVIEW.indexOf(card) * 0.3}s` }}
              >
                <div className="text-5xl mb-3">{card.emoji}</div>
                <div className="text-[#c9a84c] font-serif text-lg mb-1">
                  {card.name}
                </div>
                <div className="text-[#666] text-xs">{card.meaning}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#111111]/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif gold-gradient-text mb-4">
              Simples como a Magia Deve Ser
            </h2>
            <div className="divider-gold" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Assine",
                desc: "Escolha o plano mensal por R$29 e crie sua conta com seu e-mail.",
              },
              {
                step: "02",
                title: "Complete seu Perfil",
                desc: "Informe seu nome, signo, data de nascimento e número de WhatsApp.",
              },
              {
                step: "03",
                title: "Solicite sua Leitura",
                desc: "Clique em 'Solicitar Leitura' e receba a mensagem de ATB diretamente no seu WhatsApp.",
              },
            ].map((item) => (
              <div key={item.step} className="mystic-card p-8 text-center">
                <div className="text-[#c9a84c]/30 font-serif text-6xl font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-[#c9a84c] font-serif text-xl mb-3">
                  {item.title}
                </h3>
                <p className="text-[#888] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif gold-gradient-text mb-4">
              Almas que ATB Já Iluminou
            </h2>
            <div className="divider-gold" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.nome} className="mystic-card p-8">
                <div className="text-[#c9a84c] text-2xl mb-4">"</div>
                <p className="text-[#e8e0d0]/80 text-sm leading-relaxed italic mb-6">
                  {t.texto}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#8b0000] flex items-center justify-center text-white text-sm font-bold">
                    {t.nome.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[#e8e0d0] text-sm font-medium">{t.nome}</div>
                    <div className="text-[#666] text-xs">{t.signo}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING / CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#111111]/50" id="assinar">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-serif gold-gradient-text mb-4">
            Abra as Portas do Destino
          </h2>
          <div className="divider-gold mb-10" />

          <div className="mystic-card p-10 border border-[#c9a84c]/30 shadow-gold">
            <div className="text-[#888] text-sm mb-2">Plano Mensal</div>
            <div className="font-serif text-6xl gold-gradient-text font-bold mb-2">
              R$29
            </div>
            <div className="text-[#666] text-sm mb-8">por mês · cancele quando quiser</div>

            <ul className="text-left space-y-3 mb-10">
              {[
                "5 leituras de tarot por mês",
                "Entrega instantânea no WhatsApp",
                "Leituras personalizadas por ATB",
                "Análise de cartas exclusiva",
                "Histórico de leituras no dashboard",
              ].map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-sm text-[#e8e0d0]/80">
                  <span className="text-[#c9a84c]">✦</span>
                  {benefit}
                </li>
              ))}
            </ul>

            <a
              href="https://kiwify.app/atb-tarot-ia"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold w-full text-center block text-base py-4 rounded-lg"
            >
              Assinar por R$29/mês
            </a>
            <p className="text-[#444] text-xs mt-4">
              Após o pagamento, você receberá um e-mail para acessar sua conta.
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-[#2a2a2a] text-center">
        <div className="font-serif text-lg mb-3">
          <span className="gold-gradient-text font-bold">ATB</span>
          <span className="text-[#e8e0d0] ml-1">TAROT IA</span>
        </div>
        <p className="text-[#444] text-xs max-w-md mx-auto mb-6">
          As leituras do ATB TAROT IA têm caráter de entretenimento e reflexão.
          Não substituem aconselhamento profissional.
        </p>
        <div className="flex justify-center gap-6 text-xs text-[#444]">
          <Link href="/login" className="hover:text-[#c9a84c] transition-colors">
            Entrar
          </Link>
          <span>·</span>
          <span>© {new Date().getFullYear()} ATB TAROT IA</span>
        </div>
      </footer>
    </main>
  );
}
