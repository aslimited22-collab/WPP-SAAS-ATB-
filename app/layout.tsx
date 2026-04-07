import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATB TAROT IA — Leituras Místicas Personalizadas por IA",
  description:
    "Receba leituras de tarot profundas e personalizadas diretamente no seu WhatsApp. Powered by ATB TAROT IA.",
  keywords: "tarot, leitura de tarot, tarot online, tarot IA, ATB TAROT",
  robots: "index, follow",
  openGraph: {
    title: "ATB TAROT IA",
    description: "Leituras de tarot personalizadas por IA entregues no seu WhatsApp",
    type: "website",
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
