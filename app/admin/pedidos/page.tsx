// ─── /admin/pedidos — painel do operador dos Trabalhos Espirituais ───────────
// Server Component. Proteção: sessão Supabase (middleware) + allowlist
// ADMIN_EMAILS (lib/admin). Não-admins recebem 404 (não revela a rota).
// Interface em pt-BR — é ferramenta interna do operador.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";
import {
  listActiveServices,
  SERVICE_ORDER_STATUSES,
} from "@/lib/spiritual-services";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pago: "🟡 Aguardando dados",
  entregue: "🟢 Entregue",
  falhou: "🔴 Falhou",
  reembolsado: "⚪ Reembolsado",
};

interface OrderRow {
  id: string;
  status: string;
  cliente_nome: string | null;
  cliente_email: string;
  cliente_telefone: string | null;
  form_respondido_em: string | null;
  intencao: string | null;
  created_at: string;
  spiritual_services: { nome: string; slug: string } | null;
}

export default async function AdminPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; servico?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const { status, servico } = await searchParams;
  const supabase = createServiceSupabaseClient();

  const services = await listActiveServices(supabase);

  let query = supabase
    .from("service_orders")
    .select(
      "id, status, cliente_nome, cliente_email, cliente_telefone, intencao, form_respondido_em, created_at, spiritual_services(nome, slug)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && (SERVICE_ORDER_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  const servicoRow = services.find((s) => s.slug === servico);
  if (servicoRow) {
    query = query.eq("service_id", servicoRow.id);
  }

  const { data } = await query;
  const orders = (data ?? []) as unknown as OrderRow[];

  const filtroUrl = (patch: { status?: string; servico?: string }) => {
    const p = new URLSearchParams();
    const s = patch.status ?? status;
    const sv = patch.servico ?? servico;
    if (s) p.set("status", s);
    if (sv) p.set("servico", sv);
    const qs = p.toString();
    return `/admin/pedidos${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="font-serif text-3xl text-[#c9a84c] mb-2">
            Pedidos — Trabalhos Espirituais
          </h1>
          <p className="text-[#888] text-sm">
            {admin.email} · {orders.length} pedido(s) exibido(s)
          </p>
        </header>

        {/* ── Filtros ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href={filtroUrl({ status: "" })}
            className={`px-4 py-2 rounded-lg text-sm border ${!status ? "border-[#c9a84c] text-[#c9a84c]" : "border-[#2a2a2a] text-[#888] hover:text-[#c9a84c]"}`}
          >
            Todos os status
          </Link>
          {SERVICE_ORDER_STATUSES.map((s) => (
            <Link
              key={s}
              href={filtroUrl({ status: s })}
              className={`px-4 py-2 rounded-lg text-sm border ${status === s ? "border-[#c9a84c] text-[#c9a84c]" : "border-[#2a2a2a] text-[#888] hover:text-[#c9a84c]"}`}
            >
              {STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href={filtroUrl({ servico: "" })}
            className={`px-4 py-2 rounded-lg text-sm border ${!servico ? "border-[#c9a84c] text-[#c9a84c]" : "border-[#2a2a2a] text-[#888] hover:text-[#c9a84c]"}`}
          >
            Todos os trabalhos
          </Link>
          {services.map((s) => (
            <Link
              key={s.slug}
              href={filtroUrl({ servico: s.slug })}
              className={`px-4 py-2 rounded-lg text-sm border ${servico === s.slug ? "border-[#c9a84c] text-[#c9a84c]" : "border-[#2a2a2a] text-[#888] hover:text-[#c9a84c]"}`}
            >
              {s.nome}
            </Link>
          ))}
        </div>

        {/* ── Lista ────────────────────────────────────────────────────── */}
        {orders.length === 0 ? (
          <div className="mystic-card p-12 text-center text-[#666]">
            Nenhum pedido com esses filtros.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/pedidos/${o.id}`}
                className="mystic-card p-5 flex flex-wrap items-center gap-4 hover:border-[#c9a84c]/60 transition-all"
              >
                <span className="text-sm whitespace-nowrap">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <span className="text-[#c9a84c] font-medium">
                  {o.spiritual_services?.nome ?? "—"}
                </span>
                <span className="text-[#e8e0d0]">
                  {o.cliente_nome ?? "(sem nome)"}
                </span>
                <span className="text-[#888] text-sm">{o.cliente_email}</span>
                {!o.form_respondido_em && (
                  <span className="text-xs text-[#666] border border-[#2a2a2a] rounded-full px-3 py-1">
                    Aguardando dados do cliente
                  </span>
                )}
                <span className="text-[#555] text-xs ml-auto whitespace-nowrap">
                  {new Date(o.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
