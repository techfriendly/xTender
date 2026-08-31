import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "xTender",
  description: "Plataforma de preparación contractual asistida por IA",
  icons: { icon: "/favicon.svg" }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
