import type { Metadata } from "next";
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
        {children}
        <Toaster richColors position="top-right" theme="dark" />
        <div className="noise-overlay" />
      </body>
    </html>
  );
}
