import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://atbtartot.com"
  ),
  title: "ATB TAROT IA — Leituras Místicas Personalizadas por IA",
  description:
    "Receba leituras de tarot profundas e personalizadas diretamente no seu WhatsApp. Powered by ATB TAROT IA.",
  keywords: "tarot, leitura de tarot, tarot online, tarot IA, ATB TAROT",
  robots: "index, follow",
  openGraph: {
    title: "ATB TAROT IA — A mensagem que tocou seu coração era para você",
    description:
      "Leituras de tarot, chat com a ATB e Limpeza Espiritual — no seu idioma, direto no seu celular.",
    type: "website",
    // JPEG: WhatsApp/Facebook não aceitam webp no preview de link
    images: [
      {
        url: "/images/og-share.jpg",
        width: 1536,
        height: 1024,
        alt: "ATB TAROT IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/og-share.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
