'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { PremiumCelebrationProvider } from '@/context/PremiumCelebrationContext';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PremiumCelebrationProvider>{children}</PremiumCelebrationProvider>
    </AuthProvider>
  );
}
