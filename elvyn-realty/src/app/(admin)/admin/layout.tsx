import type { Metadata } from "next";
import "@/styles/globals.css";
import { fontDisplay, fontSans } from "@/app/fonts";

export const metadata: Metadata = { title: { default: "CRM · Elvyn Arnaud Realty", template: "%s · CRM" }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body className="min-h-screen bg-navy-50/60 font-sans text-ink">{children}</body>
    </html>
  );
}
