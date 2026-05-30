import { Suspense } from 'react';

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement…</div>}>{children}</Suspense>;
}
