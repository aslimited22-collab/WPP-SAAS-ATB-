// ESLint flat config — o `next lint` foi REMOVIDO no Next.js 16, então o lint
// roda pelo CLI do ESLint (ver o script "lint" no package.json).
// O eslint-config-next@16 já exporta um array de flat config pronto.
import next from "eslint-config-next";

const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      ".claude/**",
      "next-env.d.ts",
      // Scripts operacionais em CommonJS puro (node), fora do app Next.
      "scripts/**",
    ],
  },
  ...next,
  {
    rules: {
      // Sanitização de entrada usa ranges de caracteres de controle de
      // propósito (lib/validators.ts, lib/claude.ts, app/api/chat/route.ts).
      // Com a regra ATIVA, os `eslint-disable-next-line` desses pontos passam
      // a ser intencionais e qualquer uso NOVO e não anotado é barrado.
      "no-control-regex": "error",

      // Desligada: a regra existe para o router `pages/` (que este projeto não
      // usa — é app router puro) e aqui só produz falso positivo. Os `<a>`
      // sinalizados apontam para /api/checkout/*, que responde 307/303 para a
      // Kiwify ou o Stripe. Precisa ser navegação real do browser: o <Link>
      // faria navegação client-side, que não acompanha redirect para outra
      // origem — trocar quebraria o checkout.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
