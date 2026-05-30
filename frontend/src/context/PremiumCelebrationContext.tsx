'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import PremiumCelebrationOverlay from '@/components/premium/PremiumCelebrationOverlay';

interface CelebrateOptions {
  subtitle?: string;
}

interface PremiumCelebrationContextType {
  celebratePremium: (opts?: CelebrateOptions) => void;
}

const PremiumCelebrationContext = createContext<PremiumCelebrationContextType>({
  celebratePremium: () => {},
});

export function PremiumCelebrationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const prevPremiumRef = useRef<boolean | null>(null);
  const profileReadyRef = useRef(false);

  const celebratePremium = useCallback((opts?: CelebrateOptions) => {
    setSubtitle(opts?.subtitle);
    setVisible(true);
  }, []);

  const celebratePremiumSafe = useCallback(
    (opts?: CelebrateOptions) => {
      if (visible) return;
      celebratePremium(opts);
    },
    [visible, celebratePremium]
  );

  useEffect(() => {
    if (!user?.id) {
      prevPremiumRef.current = null;
      profileReadyRef.current = false;
      return;
    }

    const isPremium = Boolean(user.isPremium);

    if (!profileReadyRef.current) {
      prevPremiumRef.current = isPremium;
      profileReadyRef.current = true;
      return;
    }

    if (prevPremiumRef.current === false && isPremium) {
      celebratePremiumSafe();
    }
    prevPremiumRef.current = isPremium;
  }, [user?.id, user?.isPremium, celebratePremiumSafe]);

  return (
    <PremiumCelebrationContext.Provider value={{ celebratePremium: celebratePremiumSafe }}>
      {children}
      {visible && (
        <PremiumCelebrationOverlay
          subtitle={subtitle}
          expiresAt={user?.premiumExpiresAt}
          onClose={() => setVisible(false)}
        />
      )}
    </PremiumCelebrationContext.Provider>
  );
}

export function usePremiumCelebration() {
  return useContext(PremiumCelebrationContext);
}
