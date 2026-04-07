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
const cspDirectives = [
  "default-src 'self'",
  // unsafe-eval apenas em desenvolvimento (hot reload do Next.js)
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // connect-src: apenas Supabase (Auth + DB) — Claude e Z-API são server-side
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'none'",
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
