import type { Metadata } from 'next';
import ClientProviders from '@/components/ClientProviders';
import './globals.css';

export const metadata: Metadata = {
  title: 'MILOU — Économie virtuelle',
  description: 'Plateforme d\'échange de services avec la monnaie fictive Milou',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
