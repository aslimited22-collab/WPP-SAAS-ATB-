"use client";

// Página do cliente — formulário / status / registro do ritual.
// Público 60+: fonte grande, contraste alto, campos e botões generosos,
// instruções em linguagem simples e mensagens de erro claras.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DISCLAIMER_GERAL, DIREITO_ARREPENDIMENTO } from "@/content/servicos";

export interface PedidoRegistro {
  id: string;
  tipo: "foto" | "audio" | "mensagem";
  url: string | null;
  texto: string | null;
}

export interface PedidoPublico {
  token: string;
  status: string;
  servicoNome: string;
  clienteNome: string | null;
  nomeCompletoRitual: string | null;
  intencao: string | null;
  respondido: boolean;
  registros: PedidoRegistro[];
}

function primeiroNome(nome: string | null): string {
  const n = (nome ?? "").trim().split(/\s+/)[0];
  return n || "querida alma";
}

export default function PedidoClient({ pedido }: { pedido: PedidoPublico }) {
  const router = useRouter();
  const [nomeCompleto, setNomeCompleto] = useState(
    pedido.nomeCompletoRitual ?? pedido.clienteNome ?? ""
  );
  const [intencao, setIntencao] = useState(pedido.intencao ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/pedido/${pedido.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_completo: nomeCompleto, intencao }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      setSucesso(true);
      router.refresh();
    } catch {
      setErro("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const nome = primeiroNome(pedido.nomeCompletoRitual ?? pedido.clienteNome);
  const jaRespondeu = pedido.respondido || sucesso;

  return (
    <main className="min-h-screen bg-[#0a0a0a] stars-bg">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="text-center mb-10">
          <div className="text-6xl mb-5 animate-float">🕊️</div>
          <p className="text-[#c9a84c] text-sm tracking-widest uppercase mb-3">
            Seu trabalho espiritual
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl gold-gradient-text font-bold">
            {pedido.servicoNome}
          </h1>
        </header>

        {/* ── REEMBOLSADO ─────────────────────────────────────────────── */}
        {pedido.status === "reembolsado" && (
          <div className="mystic-card p-8 text-center">
            <p className="text-[#c2b9a4] text-lg leading-relaxed">
              Este pedido foi cancelado e reembolsado. Se você acredita que
              houve um engano, responda o e-mail da sua compra que eu te ajudo.
            </p>
          </div>
        )}

        {/* ── ENTREGUE: o registro do ritual ──────────────────────────── */}
        {pedido.status === "entregue" && (
          <section className="space-y-6">
            <div className="mystic-card p-8 text-center">
              <h2 className="font-serif text-2xl text-[#c9a84c] mb-4">
                {nome}, seu ritual foi realizado 💛
              </h2>
              <p className="text-[#c2b9a4] text-lg leading-relaxed">
                Fiz o seu trabalho com muito respeito, com o seu nome e a sua
                intenção. Aqui embaixo está o registro — guarde com carinho.
              </p>
            </div>

            {pedido.registros.map((r) => (
              <div key={r.id} className="mystic-card p-6">
                {r.tipo === "foto" && r.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do Storage
                  <img
                    src={r.url}
                    alt="Registro do seu ritual"
                    className="w-full rounded-lg"
                  />
                )}
                {r.tipo === "audio" && r.url && (
                  <div>
                    <p className="text-[#c9a84c] text-lg mb-3">
                      🎙️ Mensagem de voz da ATB
                    </p>
                    <audio controls src={r.url} className="w-full" />
                  </div>
                )}
                {r.tipo === "mensagem" && r.texto && (
                  <p className="text-[#e8e0d0] text-lg leading-relaxed whitespace-pre-wrap font-serif italic">
                    {r.texto}
                  </p>
                )}
              </div>
            ))}

            <div className="mystic-card p-7">
              <h3 className="text-[#c9a84c] text-lg font-medium mb-3">
                ✦ Orientações para os próximos dias
              </h3>
              <p className="text-[#c2b9a4] text-lg leading-relaxed">
                Mantenha o coração tranquilo, beba bastante água e, quando
                puder, acenda uma vela branca em um lugar seguro, agradecendo
                com as suas palavras.
              </p>
            </div>
          </section>
        )}

        {/* ── AGUARDANDO O RITUAL ─────────────────────────────────────── */}
        {jaRespondeu &&
          pedido.status !== "entregue" &&
          pedido.status !== "reembolsado" && (
            <div className="mystic-card p-8 text-center">
              <div className="text-5xl mb-4">🕯️</div>
              <h2 className="font-serif text-2xl text-[#c9a84c] mb-4">
                Recebi os seus dados, {nome}
              </h2>
              <p className="text-[#c2b9a4] text-lg leading-relaxed mb-4">
                Agora é comigo. Vou preparar e realizar o seu ritual
                pessoalmente, com o seu nome e a sua intenção, em até{" "}
                <strong className="text-[#e8e0d0]">48 horas úteis</strong>.
              </p>
              <p className="text-[#c2b9a4] text-lg leading-relaxed">
                Quando estiver pronto, você recebe um e-mail e o registro do
                trabalho aparece <strong className="text-[#e8e0d0]">nesta mesma página</strong>.
                Pode guardar este link. 💛
              </p>
            </div>
          )}

        {/* ── FORMULÁRIO (ainda não respondeu) ────────────────────────── */}
        {!jaRespondeu &&
          pedido.status !== "entregue" &&
          pedido.status !== "reembolsado" && (
            <form onSubmit={enviar} className="mystic-card p-8" noValidate>
              <h2 className="font-serif text-2xl text-[#c9a84c] mb-3">
                Só faltam dois passos
              </h2>
              <p className="text-[#c2b9a4] text-lg leading-relaxed mb-8">
                Para eu realizar o seu ritual do jeito certo, preciso que você
                me diga o seu nome completo e o que deseja trabalhar. Escreva
                do seu jeito, sem pressa.
              </p>

              <div className="mb-6">
                <label
                  htmlFor="nome_completo"
                  className="block text-[#e8e0d0] text-lg mb-2"
                >
                  1. Seu nome completo
                </label>
                <input
                  id="nome_completo"
                  type="text"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value.slice(0, 200))}
                  placeholder="Ex.: Maria Aparecida da Silva"
                  className="input-mystic text-lg"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="mb-6">
                <label
                  htmlFor="intencao"
                  className="block text-[#e8e0d0] text-lg mb-2"
                >
                  2. Sua intenção
                </label>
                <p className="text-[#9a8f78] text-base mb-2">
                  O que você deseja trabalhar neste ritual?
                </p>
                <textarea
                  id="intencao"
                  value={intencao}
                  onChange={(e) => setIntencao(e.target.value.slice(0, 4000))}
                  placeholder="Escreva com as suas palavras o que você está sentindo ou vivendo..."
                  className="input-mystic text-lg h-40 resize-none"
                  required
                />
                <p className="text-[#555] text-sm mt-1 text-right">
                  {intencao.length}/4000
                </p>
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
                {enviando ? "Enviando..." : "✦ Enviar meus dados"}
              </button>
            </form>
          )}

        {/* ── Rodapé legal ─────────────────────────────────────────────── */}
        <footer className="border-t border-[#2a2a2a] mt-10 pt-8 pb-4 text-center space-y-3">
          <p className="text-[#8a8272] text-sm leading-relaxed">
            {DISCLAIMER_GERAL}
          </p>
          <p className="text-[#8a8272] text-sm leading-relaxed">
            {DIREITO_ARREPENDIMENTO}
          </p>
        </footer>
      </div>
    </main>
  );
}
