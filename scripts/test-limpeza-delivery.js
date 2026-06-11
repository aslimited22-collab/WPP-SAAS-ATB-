// Teste E2E da entrega da Limpeza: marca o pedido de teste como pago e
// dispara o pipeline real via /api/limpeza/generate (token interno).
// Uso: node scripts/test-limpeza-delivery.js <orderId>
const fs = require("fs");
const path = require("path");

const envFile = path.join(__dirname, "..", ".env.local");
const vars = {};
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
  if (m) vars[m[1]] = m[2].trim();
}

const orderId = process.argv[2];
const url = vars.NEXT_PUBLIC_SUPABASE_URL;
const key = vars.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = vars.NEXT_PUBLIC_APP_URL;

(async () => {
  // 1. Marca como pago (simulação de webhook confirmado)
  const patch = await fetch(`${url}/rest/v1/limpeza_orders?id=eq.${orderId}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status: "paid",
      payment_provider: "stripe",
      payment_id: "teste_manual_e2e",
    }),
  });
  const rows = await patch.json();
  if (!patch.ok || !rows.length) {
    console.error("PATCH falhou:", patch.status, JSON.stringify(rows).slice(0, 200));
    process.exit(1);
  }
  console.log("1. Pedido marcado como pago:", rows[0].id, "| locale:", rows[0].locale);

  // 2. Dispara o pipeline de entrega real (geração IA + e-mail + status)
  const gen = await fetch(`${appUrl}/api/limpeza/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": vars.INTERNAL_GEN_TOKEN,
    },
    body: JSON.stringify({ orderId }),
  });
  const genBody = await gen.json();
  console.log("2. Pipeline:", gen.status, JSON.stringify(genBody, null, 1).slice(0, 600));

  // 3. Confere o estado final
  const check = await fetch(
    `${url}/rest/v1/limpeza_orders?id=eq.${orderId}&select=status,delivery_status,delivery_attempts,delivery_last_error`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  console.log("3. Estado final:", JSON.stringify(await check.json(), null, 1));

  const reading = await fetch(
    `${url}/rest/v1/limpeza_readings?order_id=eq.${orderId}&select=created_at,full_json`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const r = await reading.json();
  if (r.length) {
    console.log("4. LEITURA GERADA — título:", r[0].full_json.title);
  } else {
    console.log("4. SEM leitura gerada");
  }
})();
