import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MotionProvider, REVEAL_BOOT_SCRIPT, ToastProvider } from "@waverti/ui";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", weight: "100 900" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const manrope = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2", weight: "200 800" },
  ],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Waverti — Ne cherchez plus. Waverti le fait pour vous.",
    template: "%s · Waverti",
  },
  description: siteConfig.description,
  applicationName: "Waverti",
  authors: [{ name: siteConfig.publisher, url: siteConfig.publisherUrl }],
  creator: siteConfig.publisher,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: "Waverti",
    url: siteConfig.url,
  },
  twitter: { card: "summary_large_image" },
  robots: siteConfig.launchStatus === "preview" ? { index: false, follow: false } : { index: true, follow: true },
  formatDetection: { telephone: false, email: false, address: false },
  // iPhone / iPad : ouverture plein écran depuis l'écran d'accueil.
  appleWebApp: { capable: true, title: "Waverti", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-white font-sans text-ink antialiased">
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
