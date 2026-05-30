import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'MILOU — Économie virtuelle',
  description: 'Plateforme d\'échange de services avec la monnaie fictive Milou',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const Providers = dynamic(() => import('@/components/Providers'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0e17',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#22d3ee',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      Chargement MILOU…
    </div>
  ),
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-milou-bg text-gray-100 antialiased min-h-screen">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
