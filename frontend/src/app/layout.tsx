import type { Metadata } from "next";
import { ClientProviders } from "./client-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindPulse — Stress Detection",
  description: "Privacy-first behavioral stress detection from typing and mouse patterns",
  icons: {
    icon: "/favicon.ico",
  },
};

import { Toaster } from "sonner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-gray-200" suppressHydrationWarning>
        <ClientProviders>
          {children}
          <div className="noise-overlay" />
        </ClientProviders>
      </body>
    </html>
  );
}
