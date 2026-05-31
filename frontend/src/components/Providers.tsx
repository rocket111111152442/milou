'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { PremiumCelebrationProvider } from '@/context/PremiumCelebrationContext';
import AuthGate from '@/components/AuthGate';
import PendingReviewsGate from '@/components/PendingReviewsGate';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PremiumCelebrationProvider>
        <AuthGate>
          <PendingReviewsGate>{children}</PendingReviewsGate>
        </AuthGate>
      </PremiumCelebrationProvider>
    </AuthProvider>
  );
}
