// Gera as imagens do site com a API de imagens da OpenAI (gpt-image-1,
// com fallback para dall-e-3) usando a OPENAI_API_KEY do .env.local.
// Salva em public/images/*.{webp,png}. Uso: node scripts/generate-images.js
const fs = require("fs");
const path = require("path");

const projectDir = path.join(__dirname, "..");
const outDir = path.join(projectDir, "public", "images");
fs.mkdirSync(outDir, { recursive: true });

const envFile = path.join(projectDir, ".env.local");
let apiKey = "";
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^OPENAI_API_KEY=(.+)$/);
  if (m) apiKey = m[1].trim();
}
if (!apiKey) {
  console.error("OPENAI_API_KEY não encontrada no .env.local");
  process.exit(1);
}

const STYLE =
  "Warm, inviting spiritual atmosphere. Rich dark background (deep charcoal and midnight purple) with golden candlelight glow. Elegant, comforting, mystical but not scary. High detail, soft light, cinematic. No text, no words, no letters.";

const IMAGES = [
  {
    file: "hero-tarot.webp",
    size: "1536x1024",
    prompt: `Golden glowing tarot cards fanned out on dark velvet table, surrounded by lit candles, a delicate gold crescent moon and tiny stars floating above, soft sparkles. ${STYLE}`,
  },
  {
    file: "limpeza.webp",
    size: "1536x1024",
    prompt: `A serene white dove glowing with soft golden light, white candles and white flowers on a dark altar, gentle smoke of incense rising, sense of peace, protection and renewal. ${STYLE}`,
  },
  {
    file: "chat-atb.webp",
    size: "1024x1024",
    prompt: `A luminous crystal ball glowing warm gold on a dark mystical table with candles and scattered star sparkles, inviting feeling of a personal spiritual conversation. ${STYLE}`,
  },
];

async function generate(model, img) {
  const body = {
    model,
    prompt: img.prompt,
    n: 1,
    size: img.size,
  };
  if (model === "gpt-image-1") {
    body.output_format = "webp";
    body.quality = "high";
  } else {
    body.response_format = "b64_json";
    // dall-e-3 só aceita 1024x1024, 1792x1024, 1024x1792
    body.size = img.size === "1536x1024" ? "1792x1024" : "1024x1024";
  }
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${model}: HTTP ${res.status} — ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${model}: resposta sem b64_json`);
  return Buffer.from(b64, "base64");
}

(async () => {
  for (const img of IMAGES) {
    const dest = path.join(outDir, img.file);
    try {
      let buf;
      let used = "gpt-image-1";
      try {
        buf = await generate("gpt-image-1", img);
      } catch (e) {
        console.warn(`gpt-image-1 falhou (${e.message.slice(0, 160)}); tentando dall-e-3...`);
        used = "dall-e-3";
        buf = await generate("dall-e-3", img);
        // dall-e-3 devolve PNG — ajusta a extensão
        if (img.file.endsWith(".webp")) {
          const pngDest = dest.replace(/\.webp$/, ".png");
          fs.writeFileSync(pngDest, buf);
          console.log(`OK (${used}): ${path.basename(pngDest)} — ${(buf.length / 1024).toFixed(0)} KB`);
          continue;
        }
      }
      fs.writeFileSync(dest, buf);
      console.log(`OK (${used}): ${img.file} — ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.error(`FALHOU: ${img.file} — ${e.message.slice(0, 300)}`);
    }
  }
})();
