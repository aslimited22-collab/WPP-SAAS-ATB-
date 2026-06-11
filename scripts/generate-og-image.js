// Gera a imagem de compartilhamento social (og:image) em JPEG — WhatsApp e
// Facebook não aceitam webp de forma confiável. Uso: node scripts/generate-og-image.js
const fs = require("fs");
const path = require("path");

const projectDir = path.join(__dirname, "..");
const outDir = path.join(projectDir, "public", "images");
const envFile = path.join(projectDir, ".env.local");

let apiKey = "";
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^OPENAI_API_KEY=(.+)$/);
  if (m) apiKey = m[1].trim();
}

(async () => {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt:
        "Wide banner: glowing golden tarot cards and lit candles on dark velvet, gold crescent moon and sparkling stars above, warm inviting mystical atmosphere, deep purple and gold tones, cinematic soft light. No text, no words, no letters.",
      n: 1,
      size: "1536x1024",
      output_format: "jpeg",
      quality: "medium",
    }),
  });
  if (!res.ok) {
    console.error("Falhou:", res.status, (await res.text()).slice(0, 200));
    process.exit(1);
  }
  const data = await res.json();
  const buf = Buffer.from(data.data[0].b64_json, "base64");
  const dest = path.join(outDir, "og-share.jpg");
  fs.writeFileSync(dest, buf);
  console.log(`OK: og-share.jpg — ${(buf.length / 1024).toFixed(0)} KB`);
})();
