/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

// ─── Content-Security-Policy ──────────────────────────────────────────────────
// • unsafe-eval removido em produção (Next.js 14 não precisa em prod)
// • unsafe-inline em script-src mantido (necessário para Next.js hydration
//   sem configuração de nonces — pode ser removido com setup de nonces)
// • connect-src não inclui api.anthropic.com (chamadas à Claude são server-side)
// • object-src 'none' bloqueia Flash e plugins legados
// • worker-src 'none' bloqueia Web Workers não autorizados
// • upgrade-insecure-requests força HTTPS em produção
// ─── Google Ads (gtag.js) e a CSP ─────────────────────────────────────────────
// O tag de conversão do Google Ads precisa de três coisas que a CSP anterior
// bloqueava — por isso nenhuma conversão poderia ser registrada, mesmo com a
// tag instalada:
//   1. carregar o script  → script-src  googletagmanager.com
//   2. o ping de conversão (pixel/beacon) → img-src + connect-src google.com,
//      google.com.br e googleads.g.doubleclick.net
//   3. o iframe do conversion linker → frame-src td/googleads.doubleclick.net
// frame-ancestors 'none' e X-Frame-Options: DENY continuam intactos: o site
// segue não podendo ser embutido por terceiros.
const GOOGLE_ADS_SCRIPT = ["https://www.googletagmanager.com"];
const GOOGLE_ADS_PIXEL = [
  "https://www.googletagmanager.com",
  "https://www.google.com",
  "https://www.google.com.br",
  "https://www.google-analytics.com",
  "https://googleads.g.doubleclick.net",
];
const GOOGLE_ADS_FRAME = [
  "https://td.doubleclick.net",
  "https://googleads.g.doubleclick.net",
];

const cspDirectives = [
  "default-src 'self'",
  // unsafe-eval apenas em desenvolvimento (hot reload do Next.js)
  [
    "script-src 'self' 'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    ...GOOGLE_ADS_SCRIPT,
  ].join(" "),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  ["img-src 'self' data: blob:", ...GOOGLE_ADS_PIXEL].join(" "),
  // connect-src: Supabase (Auth + DB) + ping de conversão do Google Ads
  // — Claude e Z-API são server-side
  [
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    ...GOOGLE_ADS_PIXEL,
  ].join(" "),
  ["frame-src", ...GOOGLE_ADS_FRAME].join(" "),
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'none'",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // ── Anti-clickjacking ────────────────────────────────────────────
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // ── MIME sniffing ────────────────────────────────────────────────
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // ── HSTS: 2 anos, incluindo subdomínios, com preload ─────────────
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // ── Referrer ─────────────────────────────────────────────────────
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // ── Permissions Policy (câmera, mic, geoloc, etc.) ───────────────
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "payment=()",
              "usb=()",
              "bluetooth=()",
              "accelerometer=()",
              "gyroscope=()",
              "magnetometer=()",
              "interest-cohort=()", // FLoC opt-out
            ].join(", "),
          },
          // ── CSP ──────────────────────────────────────────────────────────
          {
            key: "Content-Security-Policy",
            value: cspDirectives,
          },
          // ── Cross-Origin: isola o processo do browser ────────────────────
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          // ── DNS prefetch desabilitado ─────────────────────────────────────
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
        ],
      },
      // ── Headers específicos para rotas de API ───────────────────────────
      {
        source: "/api/(.*)",
        headers: [
          // Impede cache de respostas de API
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
