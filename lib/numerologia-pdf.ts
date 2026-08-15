// ─── PDF do mapa numerológico — identidade visual ATB (roxo + dourado) ───────
// pdf-lib puro (sem binário/Chromium) → roda em serverless Vercel.
//
// Gerado ON-THE-FLY a partir de numerologia_readings.full_json — nada é salvo
// em storage; o download /numerologia/download/[token] regenera a cada request.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { NumerologiaJson } from "@/lib/numerologia";

// Paleta do produto (roxo profundo + dourado)
const PURPLE_BG = rgb(0.07, 0, 0.145); // #120025
const PURPLE_CARD = rgb(0.165, 0, 0.333); // #2a0055
const GOLD = rgb(0.91, 0.722, 0.294); // #e8b84b
const GOLD_LIGHT = rgb(0.965, 0.839, 0.494); // #f6d67e
const TEXT = rgb(0.96, 0.94, 1); // #f5f0ff
const TEXT_SOFT = rgb(0.77, 0.71, 0.99); // #c4b5fd

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Fontes padrão do PDF usam WinAnsi: acentos PT (á ã ç é...) passam, mas
// emoji/símbolos fora do Latin-1 quebram o encode — removemos por segurança.
function winAnsiSafe(s: string): string {
  return (s || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E -ÿ\n]/g, "")
    // O range acima (0x20–0xFF) deixa passar U+007F–U+009F (DEL + controles
    // C1), que o WinAnsi do pdf-lib NÃO codifica — crashariam o encode.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u007F-\u009F]/g, "")
    .trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of winAnsiSafe(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line); // linha final (ou vazia p/ parágrafo em branco)
  }
  return lines;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  serif: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
};

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  paintBackground(ctx.page);
  ctx.y = PAGE_H - MARGIN;
}

function paintBackground(page: PDFPage): void {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PURPLE_BG });
  // filete dourado no topo e na base
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: GOLD });
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 4, color: GOLD });
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MARGIN + 24) newPage(ctx);
}

function drawParagraph(
  ctx: Ctx,
  text: string,
  opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gapAfter?: number; maxWidth?: number; x?: number }
): void {
  const font = opts.font || ctx.sans;
  const size = opts.size ?? 11;
  const color = opts.color || TEXT;
  const maxWidth = opts.maxWidth ?? CONTENT_W;
  const x = opts.x ?? MARGIN;
  const lineH = size * 1.45;
  const lines = wrapText(text, font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, lineH);
    if (line) ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color });
    ctx.y -= lineH;
  }
  ctx.y -= opts.gapAfter ?? 8;
}

/**
 * Monta o PDF completo do mapa numerológico. Retorna bytes prontos pra
 * anexar no e-mail (Resend attachments) ou servir com Content-Disposition.
 */
export async function buildNumerologiaPdf(json: NumerologiaJson, customerName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsiSafe(json.title || "Mapa Numerologico ATB"));
  doc.setAuthor("ATB - atbtartot.com");

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: 0, serif, serifBold, sans };
  paintBackground(ctx.page);

  // ── CAPA (primeira página) ──
  ctx.y = PAGE_H - 150;
  const brand = "A T B";
  ctx.page.drawText(brand, {
    x: (PAGE_W - serifBold.widthOfTextAtSize(brand, 30)) / 2,
    y: ctx.y,
    size: 30,
    font: serifBold,
    color: GOLD,
  });
  ctx.y -= 46;
  const sub = "Numerologia";
  ctx.page.drawText(sub, {
    x: (PAGE_W - serif.widthOfTextAtSize(sub, 18)) / 2,
    y: ctx.y,
    size: 18,
    font: serif,
    color: TEXT_SOFT,
  });
  ctx.y -= 90;

  // Título do mapa, centralizado e embrulhado
  for (const line of wrapText(json.title, serifBold, 26, CONTENT_W)) {
    if (line) {
      ctx.page.drawText(line, {
        x: (PAGE_W - serifBold.widthOfTextAtSize(line, 26)) / 2,
        y: ctx.y,
        size: 26,
        font: serifBold,
        color: GOLD_LIGHT,
      });
    }
    ctx.y -= 36;
  }
  ctx.y -= 20;
  const forLine = winAnsiSafe(`Preparado com carinho para ${customerName}`);
  ctx.page.drawText(forLine, {
    x: (PAGE_W - sans.widthOfTextAtSize(forLine, 12)) / 2,
    y: ctx.y,
    size: 12,
    font: sans,
    color: TEXT,
  });

  // Card dourado central com os números da sorte
  const numeros = (json.numeros_da_sorte || []).join("   ");
  const cardY = ctx.y - 150;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: cardY,
    width: CONTENT_W,
    height: 96,
    color: PURPLE_CARD,
    borderColor: GOLD,
    borderWidth: 1.5,
  });
  const cardLabel = "SEUS NUMEROS DA SORTE";
  ctx.page.drawText(cardLabel, {
    x: (PAGE_W - sans.widthOfTextAtSize(cardLabel, 11)) / 2,
    y: cardY + 66,
    size: 11,
    font: sans,
    color: TEXT_SOFT,
  });
  ctx.page.drawText(numeros, {
    x: (PAGE_W - serifBold.widthOfTextAtSize(numeros, 28)) / 2,
    y: cardY + 26,
    size: 28,
    font: serifBold,
    color: GOLD,
  });

  const foot = "atbtartot.com";
  ctx.page.drawText(foot, {
    x: (PAGE_W - sans.widthOfTextAtSize(foot, 10)) / 2,
    y: MARGIN,
    size: 10,
    font: sans,
    color: TEXT_SOFT,
  });

  // ── CONTEÚDO ──
  newPage(ctx);
  drawParagraph(ctx, json.opening, { font: serif, size: 13, gapAfter: 18 });

  for (const n of json.numeros || []) {
    ensureSpace(ctx, 96);
    // Número grande dourado + nome da seção
    const numStr = String(n.numero);
    ctx.page.drawText(numStr, { x: MARGIN, y: ctx.y - 30, size: 34, font: serifBold, color: GOLD });
    const numW = serifBold.widthOfTextAtSize(numStr, 34);
    ctx.page.drawText(winAnsiSafe(n.nome), {
      x: MARGIN + numW + 14,
      y: ctx.y - 24,
      size: 16,
      font: serifBold,
      color: GOLD_LIGHT,
    });
    ctx.y -= 48;
    drawParagraph(ctx, n.significado, { size: 11, gapAfter: 6 });
    drawParagraph(ctx, `Como usar: ${n.como_usar}`, { size: 11, color: TEXT_SOFT, gapAfter: 18 });
  }

  ensureSpace(ctx, 60);
  drawParagraph(ctx, "Como usar seus numeros no dia a dia", {
    font: serifBold,
    size: 16,
    color: GOLD_LIGHT,
    gapAfter: 6,
  });
  drawParagraph(ctx, json.orientacao_geral, { size: 11, gapAfter: 16 });
  drawParagraph(ctx, json.closing, { font: serif, size: 12, gapAfter: 16 });
  drawParagraph(ctx, json.disclaimer, { size: 9, color: TEXT_SOFT, gapAfter: 0 });

  // Rodapé em todas as páginas de conteúdo
  const pages = doc.getPages();
  for (let i = 1; i < pages.length; i++) {
    const p = pages[i];
    p.drawText("ATB - atbtartot.com", { x: MARGIN, y: 30, size: 9, font: sans, color: TEXT_SOFT });
    const pn = `${i + 1}`;
    p.drawText(pn, { x: PAGE_W - MARGIN - sans.widthOfTextAtSize(pn, 9), y: 30, size: 9, font: sans, color: TEXT_SOFT });
  }

  return doc.save();
}
