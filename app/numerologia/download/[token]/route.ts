// ─── GET /numerologia/download/[token] — baixa o PDF do mapa numerológico ────
// Público por access_token UUID não-adivinhável (mesmo modelo de /pedido).
// Regras: pedido pago + leitura completa + dentro de 30 dias da entrega
// (fallback: da compra, quando delivered_at ainda não existe).
// O PDF é regenerado on-the-fly de numerologia_readings.full_json — sem storage.

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { buildNumerologiaPdf } from "@/lib/numerologia-pdf";
import type { NumerologiaJson } from "@/lib/numerologia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRY_DAYS = 30;

// Página de aviso com a cara do site (público 45+ clica no botão cedo demais e
// cairia num text/plain cru do navegador). Auto-refresh quando for "aguarde".
function noticeHtml(title: string, body: string, refreshSeconds?: number) {
  const refresh = refreshSeconds ? `<meta http-equiv="refresh" content="${refreshSeconds}">` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${refresh}
<title>${title} — ATB</title></head>
<body style="margin:0;background:#0a0a0a;color:#e8e0d0;font-family:Georgia,serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">
<div style="max-width:460px">
<div style="color:#c9a84c;font-size:1.4rem;letter-spacing:0.28em;font-weight:700;margin-bottom:24px">ATB</div>
<h1 style="color:#e4c97a;font-size:1.5rem;margin:0 0 14px">${title}</h1>
<p style="color:#c2b9a4;font-size:1.05rem;line-height:1.65;margin:0 0 24px">${body}</p>
<a href="javascript:location.reload()" style="display:inline-block;background:linear-gradient(135deg,#e4c97a,#c9a84c);color:#0a0a14;font-weight:700;padding:14px 28px;border-radius:14px;text-decoration:none">🔄 Tentar de novo</a>
</div></body></html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`numerologia_download:${ipAddress}`);
  if (!rl.success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const { token } = await params;
  if (!UUID_RE.test((token ?? "").trim())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("numerologia_orders")
    .select("id, name, status, created_at, delivered_at")
    .eq("access_token", token.trim())
    .maybeSingle();

  if (!order) return new NextResponse("Not found", { status: 404 });
  if (order.status !== "paid") {
    return new NextResponse("Pagamento não confirmado", { status: 403 });
  }

  // Os 30 dias contam da ENTREGA (o e-mail promete "30 dias" a partir dali),
  // não da compra — quem demorou a preencher o form não perde prazo.
  // Fallback em created_at pra pedido ainda sem delivered_at.
  const ageMs =
    Date.now() - new Date(order.delivered_at ?? order.created_at).getTime();
  if (ageMs > EXPIRY_DAYS * 24 * 3600 * 1000) {
    return new NextResponse(
      noticeHtml(
        "Este link expirou",
        "Links de download valem por 30 dias. Fale com a gente que reenviamos o seu mapa com carinho."
      ),
      { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const { data: reading } = await supabase
    .from("numerologia_readings")
    .select("full_json, generation_status")
    .eq("order_id", order.id)
    .maybeSingle();

  if (!reading?.full_json || reading.generation_status !== "completed") {
    return new NextResponse(
      noticeHtml(
        "Seu mapa está sendo preparado ✨",
        "A ATB está finalizando o seu mapa de Numerologia. Esta página atualiza sozinha — ou volte em alguns minutos. Ele também chega no seu e-mail.",
        20
      ),
      { status: 409, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const pdfBytes = await buildNumerologiaPdf(
      reading.full_json as NumerologiaJson,
      order.name || "Cliente ATB"
    );
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="numerologia-atb.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(
      "[Numerologia] Falha ao gerar PDF no download:",
      err instanceof Error ? err.message : ""
    );
    return new NextResponse("Erro ao gerar o PDF. Tente novamente.", { status: 500 });
  }
}
