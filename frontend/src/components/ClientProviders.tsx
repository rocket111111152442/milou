'use client';

import { useEffect, useState, ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';

/** Évite l’initialisation Firebase pendant le rendu serveur (build Vercel). */
export default function ClientProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-milou-bg">
        <div className="text-cyan-400 animate-pulse">MILOU</div>
      </div>
    );
  }
  return <AuthProvider>{children}</AuthProvider>;
}
