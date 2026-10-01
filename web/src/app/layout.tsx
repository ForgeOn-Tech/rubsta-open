import type { Metadata, Viewport } from "next";
import "./globals.css";

import "@/auth/types";

export const metadata: Metadata = {
  title: "Rubsta Open · Tournament OS",
  description:
    "Rubsta Open 2026 registration · Powered by ForgeLabs. Tournament OS entry surface.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="rubsta-theme">{children}</body>
    </html>
  );
}
