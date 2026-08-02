"use client";

// Detalhe do pedido — a entrega é AUTOMÁTICA; o painel serve para acompanhar
// e para agir quando algo falha: corrigir os dados da cliente, reprocessar a
// geração e reenviar o lembrete de dados pendentes.

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PedidoData {
  id: string;
  status: string;
  servicoNome: string;
  clienteNome: string | null;
  clienteEmail: string;
  clienteTelefone: string | null;
  pedidoUrl: string;
  nomeCompletoRitual: string | null;
  intencao: string | null;
  formRespondidoEm: string | null;
  kiwifyOrderId: string;
  amountCents: number | null;
  pagoEm: string | null;
  entregueEm: string | null;
  reembolsadoEm: string | null;
  lembreteEnviadoEm: string | null;
  confirmacaoEmailOk: boolean | null;
  createdAt: string;
  temImagem: boolean;
  temLeitura: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  pago: "🟡 Pago — aguardando a cliente escrever a intenção",
  entregue: "🟢 Entregue",
  falhou: "🔴 Falhou na geração",
  reembolsado: "⚪ Reembolsado",
};

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PedidoDetailClient({ pedido }: { pedido: PedidoData }) {
  const router = useRouter();
  const [nomeRitual, setNomeRitual] = useState(pedido.nomeCompletoRitual ?? "");
  const [intencao, setIntencao] = useState(pedido.intencao ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(
    label: string,
    fn: () => Promise<Response>,
    confirmText?: string
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(label);
    setMsg(null);
    setErro(null);
    try {
      const res = await fn();
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? `Erro (${res.status})`);
      } else {
        setMsg("✓ Feito!");
        router.refresh();
      }
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setBusy(null);
    }
  }

  const patch = (body: Record<string, unknown>) =>
    fetch(`/api/admin/pedidos/${pedido.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  return (
    <div className="space-y-6">
      <header className="mystic-card p-6">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <h1 className="font-serif text-2xl text-[#c9a84c]">
            {pedido.servicoNome}
          </h1>
          <span className="text-base">
            {STATUS_LABEL[pedido.status] ?? pedido.status}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-[#c2b9a4]">
          <p>
            <span className="text-[#888]">Cliente:</span>{" "}
            {pedido.clienteNome ?? "(sem nome)"}
          </p>
          <p>
            <span className="text-[#888]">E-mail:</span> {pedido.clienteEmail}
          </p>
          <p>
            <span className="text-[#888]">Telefone (referência):</span>{" "}
            {pedido.clienteTelefone ?? "(não informado)"}
          </p>
          <p>
            <span className="text-[#888]">Pedido Kiwify:</span>{" "}
            {pedido.kiwifyOrderId}
          </p>
          <p>
            <span className="text-[#888]">Valor:</span>{" "}
            {pedido.amountCents != null
              ? `R$ ${(pedido.amountCents / 100).toFixed(2)}`
              : "—"}
          </p>
          <p>
            <span className="text-[#888]">E-mail de confirmação:</span>{" "}
            {pedido.confirmacaoEmailOk == null
              ? "—"
              : pedido.confirmacaoEmailOk
                ? "✓ enviado"
                : "✗ falhou"}
          </p>
          <p>
            <span className="text-[#888]">Leitura gerada:</span>{" "}
            {pedido.temLeitura ? "✓" : "—"}
          </p>
          <p>
            <span className="text-[#888]">Imagem gerada:</span>{" "}
            {pedido.temImagem ? "✓" : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 pt-4 border-t border-[#2a2a2a] text-xs text-[#666]">
          <span>Compra: {fmtData(pedido.createdAt)}</span>
          <span>Dados da cliente: {fmtData(pedido.formRespondidoEm)}</span>
          <span>Entregue: {fmtData(pedido.entregueEm)}</span>
          {pedido.reembolsadoEm && (
            <span className="text-red-400">
              Reembolsado: {fmtData(pedido.reembolsadoEm)}
            </span>
          )}
          {pedido.lembreteEnviadoEm && (
            <span>Último lembrete: {fmtData(pedido.lembreteEnviadoEm)}</span>
          )}
        </div>
      </header>

      {msg && (
        <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3 text-green-400 text-sm">
          {msg}
        </div>
      )}
      {erro && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 text-red-400 text-sm">
          {erro}
        </div>
      )}

      {/* ── Link da cliente ───────────────────────────────────────────── */}
      <section className="mystic-card p-6">
        <h2 className="text-[#c9a84c] font-medium mb-3">🔗 Página da cliente</h2>
        <p className="text-[#c2b9a4] text-sm mb-3">
          {pedido.formRespondidoEm
            ? `A cliente escreveu a intenção em ${fmtData(pedido.formRespondidoEm)}.`
            : "A cliente ainda não escreveu a intenção — sem isso o trabalho não é gerado. Use o lembrete abaixo se já fizer 24h."}
        </p>
        <a
          href={pedido.pedidoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#c9a84c] text-sm underline break-all"
        >
          {pedido.pedidoUrl}
        </a>
      </section>

      {/* ── Dados usados na geração ───────────────────────────────────── */}
      <section className="mystic-card p-6 space-y-4">
        <h2 className="text-[#c9a84c] font-medium">
          📿 Dados usados no trabalho
        </h2>
        <div>
          <label htmlFor="nomeRitual" className="block text-sm text-[#888] mb-1">
            Nome completo
          </label>
          <input
            id="nomeRitual"
            type="text"
            value={nomeRitual}
            onChange={(e) => setNomeRitual(e.target.value.slice(0, 200))}
            className="input-mystic"
            placeholder="Nome completo da cliente"
          />
        </div>
        <div>
          <label htmlFor="intencao" className="block text-sm text-[#888] mb-1">
            Intenção (nas palavras da cliente)
          </label>
          <textarea
            id="intencao"
            value={intencao}
            onChange={(e) => setIntencao(e.target.value.slice(0, 4000))}
            className="input-mystic h-32 resize-none"
            placeholder="Ainda não preenchida"
          />
        </div>
        <button
          onClick={() =>
            chamar("salvar", () =>
              patch({ nome_completo_ritual: nomeRitual, intencao })
            )
          }
          disabled={busy !== null}
          className="btn-gold px-6 py-3"
        >
          {busy === "salvar" ? "Salvando..." : "Salvar dados"}
        </button>
      </section>

      {/* ── Ações ─────────────────────────────────────────────────────── */}
      <section className="mystic-card p-6 space-y-3">
        <h2 className="text-[#c9a84c] font-medium mb-2">⚡ Ações</h2>

        {pedido.status !== "reembolsado" && (
          <button
            onClick={() =>
              chamar(
                "reprocessar",
                () => patch({ acao: "reprocessar" }),
                pedido.status === "entregue"
                  ? "Este pedido já foi entregue. Reprocessar só regera se ainda não houver leitura. Continuar?"
                  : "Gerar agora a leitura e a imagem desta cliente?"
              )
            }
            disabled={busy !== null || !intencao.trim() || !nomeRitual.trim()}
            className="btn-gold w-full py-4 text-base"
          >
            {busy === "reprocessar"
              ? "Gerando... pode levar um minuto"
              : "🔮 Gerar / reprocessar o trabalho"}
          </button>
        )}
        {(!intencao.trim() || !nomeRitual.trim()) && (
          <p className="text-[#c9a84c] text-sm">
            Preencha nome e intenção acima para poder gerar.
          </p>
        )}

        {pedido.status === "pago" && !pedido.formRespondidoEm && (
          <button
            onClick={() =>
              chamar(
                "lembrete",
                () =>
                  fetch(`/api/admin/pedidos/${pedido.id}/lembrete`, {
                    method: "POST",
                  }),
                "Enviar e-mail lembrando a cliente de escrever nome e intenção?"
              )
            }
            disabled={busy !== null}
            className="w-full py-4 text-base border border-[#c9a84c]/40 text-[#c9a84c] rounded-lg hover:bg-[#c9a84c]/10 transition-colors"
          >
            {busy === "lembrete" ? "..." : "🔔 Enviar lembrete de dados pendentes"}
          </button>
        )}

        {pedido.status === "reembolsado" && (
          <p className="text-red-400 text-base">
            ✗ Pedido reembolsado em {fmtData(pedido.reembolsadoEm)}.
          </p>
        )}
      </section>
    </div>
  );
}
