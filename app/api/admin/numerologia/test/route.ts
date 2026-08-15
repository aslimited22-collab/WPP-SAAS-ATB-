// ─── POST /api/admin/numerologia/test ────────────────────────────────────────
// Gera uma numerologia de TESTE sem compra: prova o fluxo completo
// (DeepSeek → PDF → Resend com anexo) sem tocar em numerologia_orders.
// Guard: allowlist ADMIN_EMAILS via getAdminUser() (padrão do painel /admin;
// o middleware já exige sessão em /api/admin).
//
// Uso (logado como admin):
//   POST /api/admin/numerologia/test
//   { "name": "Maria Teste da Silva", "birthDate": "1962-05-14" }
// Body opcional: "email" (default ADMIN_NOTIFY_EMAIL) e "sendEmail": false
// pra só validar geração+PDF sem enviar nada.

import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { generateNumerologiaReading } from "@/lib/numerologia";
import { buildNumerologiaPdf } from "@/lib/numerologia-pdf";
import { sendEmail, escapeHtml } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let body: { name?: string; birthDate?: string; email?: string; sendEmail?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const birthDate = (body.birthDate || "").trim();
  if (name.length < 5 || !DATE_RE.test(birthDate)) {
    return NextResponse.json(
      { error: "name (completo) e birthDate (YYYY-MM-DD) obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const t0 = Date.now();
    const { json, text } = await generateNumerologiaReading({ name, birthDate });
    const genMs = Date.now() - t0;

    const pdfBytes = await buildNumerologiaPdf(json, name);

    let emailStatus = "skipped";
    if (body.sendEmail !== false) {
      const to = (
        body.email ||
        process.env.ADMIN_NOTIFY_EMAIL ||
        admin.email ||
        ""
      ).trim();
      if (!to) {
        emailStatus = "skipped (sem destinatário)";
      } else {
        const result = await sendEmail({
          to,
          subject: `[TESTE] Numerologia — ${name}`,
          // Saída bruta do modelo interpolada no HTML — escapeHtml impede
          // que markup gerado pela IA vire tag ativa no e-mail.
          html: `<p>Teste do produto Numerologia (sem compra).</p><pre style="white-space:pre-wrap;font-family:Georgia,serif;">${escapeHtml(text.slice(0, 1500))}</pre>`,
          attachments: [
            {
              filename: "numerologia-teste.pdf",
              content: Buffer.from(pdfBytes).toString("base64"),
            },
          ],
        });
        emailStatus = result.ok ? `sent to ${to}` : `failed: ${result.reason}`;
      }
    }

    return NextResponse.json({
      ok: true,
      generationMs: genMs,
      pdfBytes: pdfBytes.length,
      email: emailStatus,
      numeros: json.numeros.map((n) => `${n.nome}: ${n.numero}`),
      numeros_da_sorte: json.numeros_da_sorte,
      title: json.title,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Numerologia] Teste falhou:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
