"use client";

// Detalhe do pedido — ações do operador:
//   salvar nome/intencão · marcar em_preparacao · marcar ritual_realizado ·
//   upload de foto/áudio · realizar entrega · lembrete de dados pendentes.

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PedidoDeliverable {
  id: string;
  tipo: string;
  enviadoEm: string | null;
  previewUrl: string | null;
  conteudoTexto: string | null;
}

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
  intencaoAguardandoRevisao: boolean;
  formRespondidoEm: string | null;
  kiwifyOrderId: string;
  amountCents: number | null;
  pagoEm: string | null;
  emPreparacaoEm: string | null;
  ritualRealizadoEm: string | null;
  entregueEm: string | null;
  reembolsadoEm: string | null;
  lembreteEnviadoEm: string | null;
  confirmacaoEmailOk: boolean | null;
  createdAt: string;
  deliverables: PedidoDeliverable[];
}

const STATUS_LABEL: Record<string, string> = {
  pago: "🟡 Pago",
  em_preparacao: "🔵 Em preparação",
  ritual_realizado: "🟣 Ritual realizado",
  entregue: "🟢 Entregue",
  reembolsado: "🔴 Reembolsado",
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

  async function onUpload(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    await chamar("upload", () =>
      fetch(`/api/admin/pedidos/${pedido.id}/upload`, {
        method: "POST",
        body: fd,
      })
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <header className="mystic-card p-6">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <h1 className="font-serif text-2xl text-[#c9a84c]">
            {pedido.servicoNome}
          </h1>
          <span className="text-base">{STATUS_LABEL[pedido.status]}</span>
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
            <span className="text-[#888]">Compra:</span>{" "}
            {fmtData(pedido.createdAt)}
          </p>
          <p>
            <span className="text-[#888]">E-mail de confirmação:</span>{" "}
            {pedido.confirmacaoEmailOk == null
              ? "—"
              : pedido.confirmacaoEmailOk
                ? "✓ enviada"
                : "✗ falhou"}
          </p>
        </div>
        {/* Linha do tempo */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 pt-4 border-t border-[#2a2a2a] text-xs text-[#666]">
          <span>Pago: {fmtData(pedido.pagoEm)}</span>
          <span>Em preparação: {fmtData(pedido.emPreparacaoEm)}</span>
          <span>Ritual realizado: {fmtData(pedido.ritualRealizadoEm)}</span>
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

      {/* ── Link único do cliente ─────────────────────────────────────── */}
      <section className="mystic-card p-6">
        <h2 className="text-[#c9a84c] font-medium mb-3">
          🔗 Link do cliente{" "}
          {pedido.intencaoAguardandoRevisao && (
            <span className="text-xs bg-[#c9a84c]/20 border border-[#c9a84c]/40 rounded-full px-3 py-1 ml-2">
              dados recebidos — revisar
            </span>
          )}
        </h2>
        <p className="text-[#c2b9a4] text-sm mb-3">
          {pedido.formRespondidoEm
            ? `O cliente preencheu os dados em ${fmtData(pedido.formRespondidoEm)}. Revise os campos abaixo antes de realizar o ritual.`
            : "O cliente ainda não preencheu os dados. Use o botão de lembrete se já fizer 24h."}
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

      {/* ── Campos do ritual (editáveis) ──────────────────────────────── */}
      <section className="mystic-card p-6 space-y-4">
        <h2 className="text-[#c9a84c] font-medium">📿 Dados do ritual</h2>
        <div>
          <label htmlFor="nomeRitual" className="block text-sm text-[#888] mb-1">
            Nome completo para o ritual
          </label>
          <input
            id="nomeRitual"
            type="text"
            value={nomeRitual}
            onChange={(e) => setNomeRitual(e.target.value.slice(0, 200))}
            className="input-mystic"
            placeholder="Nome completo do cliente"
          />
        </div>
        <div>
          <label htmlFor="intencao" className="block text-sm text-[#888] mb-1">
            Intenção do trabalho
          </label>
          <textarea
            id="intencao"
            value={intencao}
            onChange={(e) => setIntencao(e.target.value.slice(0, 4000))}
            className="input-mystic h-32 resize-none"
            placeholder="Intenção organizada a partir da resposta do cliente"
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
          {busy === "salvar" ? "Salvando..." : "Salvar dados do ritual"}
        </button>
      </section>

      {/* ── Registros (foto/áudio) ────────────────────────────────────── */}
      <section className="mystic-card p-6 space-y-4">
        <h2 className="text-[#c9a84c] font-medium">📎 Registro do ritual</h2>
        {pedido.deliverables.length > 0 && (
          <ul className="space-y-3">
            {pedido.deliverables.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-4 border border-[#2a2a2a] rounded-lg p-3"
              >
                {d.tipo === "foto" && d.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview de signed URL temporária
                  <img
                    src={d.previewUrl}
                    alt="Foto do ritual"
                    className="w-20 h-20 object-cover rounded-md"
                  />
                ) : (
                  <span className="text-3xl">
                    {d.tipo === "audio" ? "🎙️" : d.tipo === "foto" ? "🖼️" : "💬"}
                  </span>
                )}
                <div className="flex-1 text-sm">
                  <p className="text-[#e8e0d0] capitalize">{d.tipo}</p>
                  {d.tipo === "audio" && d.previewUrl && (
                    <audio controls src={d.previewUrl} className="mt-1 h-9" />
                  )}
                  {d.conteudoTexto && (
                    <p className="text-[#888]">{d.conteudoTexto}</p>
                  )}
                </div>
                <span className="text-xs text-[#666] whitespace-nowrap">
                  {d.enviadoEm ? `✓ enviado ${fmtData(d.enviadoEm)}` : "não enviado"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {pedido.status !== "entregue" && pedido.status !== "reembolsado" && (
          <div>
            <label
              htmlFor="upload"
              className="block text-sm text-[#888] mb-2"
            >
              Anexar foto (JPG/PNG/WebP) ou áudio (MP3/OGG/M4A) — máx. 25 MB
            </label>
            <input
              id="upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,audio/*"
              disabled={busy !== null}
              onChange={(e) => {
                onUpload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
              className="text-sm text-[#c2b9a4] file:btn-gold file:border-0 file:px-4 file:py-2 file:mr-4 file:cursor-pointer"
            />
            {busy === "upload" && (
              <p className="text-[#c9a84c] text-sm mt-2">Enviando arquivo...</p>
            )}
          </div>
        )}
      </section>

      {/* ── Ações ─────────────────────────────────────────────────────── */}
      <section className="mystic-card p-6 space-y-3">
        <h2 className="text-[#c9a84c] font-medium mb-2">⚡ Ações</h2>

        {pedido.status === "pago" && (
          <button
            onClick={() =>
              chamar("prep", () => patch({ status: "em_preparacao" }))
            }
            disabled={busy !== null}
            className="btn-gold w-full py-4 text-base"
          >
            {busy === "prep" ? "..." : "🔵 Marcar EM PREPARAÇÃO"}
          </button>
        )}

        {pedido.status === "em_preparacao" && (
          <button
            onClick={() =>
              chamar(
                "realizado",
                () => patch({ status: "ritual_realizado" }),
                "Confirma que o ritual foi REALIZADO pessoalmente? Essa marcação libera a entrega."
              )
            }
            disabled={busy !== null}
            className="btn-gold w-full py-4 text-base"
          >
            {busy === "realizado" ? "..." : "🟣 Marcar RITUAL REALIZADO"}
          </button>
        )}

        {pedido.status === "ritual_realizado" && (
          <button
            onClick={() =>
              chamar(
                "entregar",
                () =>
                  fetch(`/api/admin/pedidos/${pedido.id}/entregar`, {
                    method: "POST",
                  }),
                `Enviar agora o e-mail de entrega para ${pedido.clienteEmail}? O cliente verá ${pedido.deliverables.length} registro(s) na página dele.`
              )
            }
            disabled={busy !== null || pedido.deliverables.length === 0}
            className="btn-gold w-full py-4 text-base"
          >
            {busy === "entregar"
              ? "Enviando entrega..."
              : "🕊️ REALIZAR ENTREGA (e-mail + liberar registros)"}
          </button>
        )}
        {pedido.status === "ritual_realizado" &&
          pedido.deliverables.length === 0 && (
            <p className="text-[#c9a84c] text-sm">
              Anexe pelo menos um registro (foto/áudio) antes de entregar.
            </p>
          )}

        {(pedido.status === "pago" || pedido.status === "em_preparacao") &&
          !pedido.formRespondidoEm && (
            <button
              onClick={() =>
                chamar(
                  "lembrete",
                  () =>
                    fetch(`/api/admin/pedidos/${pedido.id}/lembrete`, {
                      method: "POST",
                    }),
                  "Enviar lembrete pedindo nome completo e intenção?"
                )
              }
              disabled={busy !== null}
              className="w-full py-4 text-base border border-[#c9a84c]/40 text-[#c9a84c] rounded-lg hover:bg-[#c9a84c]/10 transition-colors"
            >
              {busy === "lembrete"
                ? "..."
                : "🔔 Enviar lembrete de dados pendentes"}
            </button>
          )}

        {pedido.status === "entregue" && (
          <p className="text-green-400 text-base">
            ✓ Pedido entregue em {fmtData(pedido.entregueEm)}.
          </p>
        )}
        {pedido.status === "reembolsado" && (
          <p className="text-red-400 text-base">
            ✗ Pedido reembolsado — NÃO realizar o ritual.
          </p>
        )}
      </section>
    </div>
  );
}
