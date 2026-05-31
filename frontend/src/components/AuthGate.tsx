'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import CompleteProfile from '@/components/CompleteProfile';
import CompletePostalCode from '@/components/CompletePostalCode';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/premium',
  '/premium/success',
  '/marketplace',
];

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, needsProfile, needsPostalCode } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-milou-bg">
        <img src="/milou-logo.svg" alt="" width={32} height={32} className="animate-pulse" />
        <p className="text-zinc-500 text-sm">Chargement…</p>
      </div>
    );
  }

  if (needsProfile) {
    return <CompleteProfile />;
  }

  if (user && needsPostalCode && !PUBLIC_PATHS.includes(pathname)) {
    return <CompletePostalCode />;
  }

  return <>{children}</>;
}
