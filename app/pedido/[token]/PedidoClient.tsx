"use client";

// Página do cliente — formulário e, depois, a leitura + a imagem espiritual.
// Público 60+: fonte grande, contraste alto, campos e botões generosos,
// instruções simples e mensagens de erro claras.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DISCLAIMER_GERAL, DIREITO_ARREPENDIMENTO } from "@/content/servicos";

export interface LeituraJson {
  title: string;
  opening: string;
  reading: string;
  ritual_message: string;
  protection_message: string;
  next_steps: string[];
  closing: string;
  disclaimer: string;
}

export interface PedidoPublico {
  token: string;
  status: string;
  servicoNome: string;
  clienteNome: string | null;
  nomeCompletoRitual: string | null;
  respondido: boolean;
  leitura: LeituraJson | null;
  imagemUrl: string | null;
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
  const [intencao, setIntencao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      router.refresh();
    } catch {
      setErro("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const nome = primeiroNome(pedido.nomeCompletoRitual ?? pedido.clienteNome);
  const l = pedido.leitura;
  const mostrarFormulario =
    pedido.status !== "entregue" && pedido.status !== "reembolsado";

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

        {/* ── ENTREGUE: leitura + imagem ──────────────────────────────── */}
        {pedido.status === "entregue" && l && (
          <section className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="font-serif text-3xl gold-gradient-text mb-3">
                {l.title}
              </h2>
              <div className="divider-gold" />
            </div>

            {pedido.imagemUrl && (
              <figure className="mystic-card p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do Storage */}
                <img
                  src={pedido.imagemUrl}
                  alt={`Imagem espiritual criada para a intenção de ${nome}`}
                  className="w-full rounded-lg"
                />
                <figcaption className="text-[#9a8f78] text-sm text-center mt-3">
                  Imagem espiritual criada para a sua intenção
                </figcaption>
              </figure>
            )}

            <div className="mystic-card p-8 border border-[#c9a84c]/30">
              <p className="text-[#e8e0d0] text-lg leading-relaxed whitespace-pre-line">
                {l.opening}
              </p>
            </div>

            <div className="mystic-card p-8">
              <p className="text-[#e8e0d0]/90 text-lg leading-relaxed whitespace-pre-line">
                {l.reading}
              </p>
            </div>

            <div className="mystic-card p-8">
              <p className="text-[#e8e0d0]/90 text-lg leading-relaxed whitespace-pre-line">
                {l.ritual_message}
              </p>
            </div>

            <div className="mystic-card p-8">
              <p className="text-[#e8e0d0]/90 text-lg leading-relaxed whitespace-pre-line">
                {l.protection_message}
              </p>
            </div>

            {Array.isArray(l.next_steps) && l.next_steps.length > 0 && (
              <div className="mystic-card p-8 border border-[#c9a84c]/20">
                <h3 className="font-serif text-xl text-[#c9a84c] mb-4">
                  ✦ Seus passos
                </h3>
                <ol className="space-y-4">
                  {l.next_steps.map((s, i) => (
                    <li key={i} className="flex gap-4 items-start">
                      <span className="shrink-0 w-9 h-9 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/50 flex items-center justify-center text-[#c9a84c] font-bold">
                        {i + 1}
                      </span>
                      <p className="text-[#e8e0d0]/90 text-lg leading-relaxed">
                        {s}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mystic-card p-8">
              <p className="text-[#e8e0d0] text-lg leading-relaxed whitespace-pre-line font-serif italic">
                {l.closing}
              </p>
            </div>

            <p className="text-[#9a8f78] text-base leading-relaxed text-center px-4">
              {l.disclaimer}
            </p>
          </section>
        )}

        {/* ── FORMULÁRIO ──────────────────────────────────────────────── */}
        {mostrarFormulario && (
          <form onSubmit={enviar} className="mystic-card p-8" noValidate>
            <h2 className="font-serif text-2xl text-[#c9a84c] mb-3">
              {pedido.status === "falhou"
                ? "Vamos tentar de novo"
                : "Só faltam dois passos"}
            </h2>
            <p className="text-[#c2b9a4] text-lg leading-relaxed mb-8">
              Me diga o seu nome completo e o que você deseja trabalhar.
              Escreva do seu jeito, sem pressa — é a partir das suas palavras
              que eu preparo o seu trabalho.
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
                O que você deseja trabalhar?
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
              {enviando
                ? "Preparando o seu trabalho... pode levar um minuto"
                : "✦ Preparar o meu trabalho"}
            </button>
            <p className="text-[#9a8f78] text-sm text-center mt-4">
              Fica pronto aqui mesmo, nesta página.
            </p>
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
