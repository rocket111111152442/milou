import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MILOU — Échangez des services en monnaie virtuelle',
  description:
    'Marketplace communautaire pour échanger des compétences avec la monnaie fictive Milou. Gratuit, sans argent réel.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const Providers = dynamic(() => import('@/components/Providers'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-milou-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <img src="/milou-logo.svg" alt="" width={32} height={32} className="animate-pulse" />
        <p className="text-zinc-500 text-sm">Chargement…</p>
      </div>
    </div>
  ),
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={jakarta.variable}>
      <body className="font-sans bg-milou-bg text-zinc-100 antialiased min-h-screen">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
