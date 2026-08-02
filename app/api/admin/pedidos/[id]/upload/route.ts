// ─── POST /api/admin/pedidos/[id]/upload ─────────────────────────────────────
// Upload do REGISTRO do ritual (foto ou áudio) para o bucket privado
// `service-deliverables` + linha em service_deliverables. Multipart form
// com o campo `file`. Só operador (admin) usa.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// Tipos aceitos e o `tipo` correspondente no banco.
const MIME_MAP: Array<{ re: RegExp; tipo: "foto" | "audio" }> = [
  { re: /^image\/(jpeg|png|webp|heic|heif)$/i, tipo: "foto" },
  { re: /^audio\/(mpeg|mp4|m4a|aac|ogg|opus|wav|webm)$/i, tipo: "audio" },
];

function extensaoSegura(filename: string): string {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("service_orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (order.status === "reembolsado") {
    return NextResponse.json(
      { error: "Pedido reembolsado — não anexar registro" },
      { status: 422 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Form inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo `file` ausente" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo vazio ou maior que 25 MB" },
      { status: 413 }
    );
  }

  const mime = file.type || "application/octet-stream";
  const match = MIME_MAP.find((m) => m.re.test(mime));
  if (!match) {
    return NextResponse.json(
      { error: `Tipo não aceito (${mime}). Envie foto (JPG/PNG/WebP) ou áudio (MP3/OGG/M4A).` },
      { status: 415 }
    );
  }

  // Caminho: <orderId>/<timestamp>-<tipo>.<ext> — sem usar o nome original
  // (evita characters problemáticos e path traversal).
  const path = `${id}/${Date.now()}-${match.tipo}.${extensaoSegura(file.name)}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("service-deliverables")
    .upload(path, bytes, { contentType: mime, upsert: false });

  if (upErr) {
    console.error("[Admin] Falha no upload:", upErr.message);
    return NextResponse.json({ error: "Erro ao enviar arquivo" }, { status: 500 });
  }

  const { data: deliverable, error: insErr } = await supabase
    .from("service_deliverables")
    .insert({ order_id: id, tipo: match.tipo, storage_path: path })
    .select("id")
    .single();

  if (insErr) {
    // rollback do arquivo órfão (best-effort)
    await supabase.storage.from("service-deliverables").remove([path]);
    console.error("[Admin] Falha ao registrar deliverable:", insErr.message);
    return NextResponse.json({ error: "Erro ao registrar arquivo" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, deliverableId: deliverable.id, tipo: match.tipo },
    { status: 201 }
  );
}
