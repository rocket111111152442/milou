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
  const prevPremiumKeyRef = useRef<string | null>(null);
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
      prevPremiumKeyRef.current = null;
      profileReadyRef.current = false;
      return;
    }

    const isPremium = Boolean(user.isPremium);
    const premiumKey = isPremium ? user.premiumExpiresAt || user.premiumActivatedAt || null : null;
    const storageKey = `milou:premium-celebrated:${user.id}`;
    const lastCelebratedKey =
      typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;

    if (!profileReadyRef.current) {
      prevPremiumKeyRef.current = premiumKey;
      profileReadyRef.current = true;
      if (premiumKey && lastCelebratedKey !== premiumKey) {
        celebratePremiumSafe();
        window.localStorage.setItem(storageKey, premiumKey);
      }
      return;
    }

    if (premiumKey && premiumKey !== prevPremiumKeyRef.current && lastCelebratedKey !== premiumKey) {
      celebratePremiumSafe();
      window.localStorage.setItem(storageKey, premiumKey);
    }
    prevPremiumKeyRef.current = premiumKey;
  }, [user?.id, user?.isPremium, user?.premiumActivatedAt, user?.premiumExpiresAt, celebratePremiumSafe]);

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
