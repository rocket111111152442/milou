'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client';
import { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  needsProfile: boolean;
  authError: string | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const PUBLIC_PATHS = ['/', '/login', '/register'];

/** Lecture profil via API serveur (évite les bugs Firestore navigateur) */
async function loadUserProfile(_uid: string, idToken: string): Promise<User | null> {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Profil inaccessible');
  }
  const { user } = await res.json();
  return user as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    try {
      if (isFirebaseConfigured()) await signOut(getFirebaseAuth());
    } catch {
      /* ignore */
    }
    setUser(null);
    setNeedsProfile(false);
    router.push('/login');
  };

  const refreshUser = async () => {
    const firebaseAuth = getFirebaseAuth();
    const current = firebaseAuth.currentUser;
    if (!current) return;
    try {
      const token = await current.getIdToken();
      const u = await loadUserProfile(current.uid, token);
      setUser(u);
      setNeedsProfile(!u);
      setAuthError(null);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Erreur profil');
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAuthError('Firebase non configuré dans .env.local');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setAuthError('Connexion Firebase trop lente. Rafraîchissez la page (F5).');
      }
    }, 12000);

    const unsub = onAuthStateChanged(
      getFirebaseAuth(),
      async (firebaseUser) => {
        clearTimeout(timeout);
        if (cancelled) return;

        if (!firebaseUser) {
          setUser(null);
          setNeedsProfile(false);
          setLoading(false);
          if (!PUBLIC_PATHS.includes(pathname)) router.push('/login');
          return;
        }

        try {
          const token = await firebaseUser.getIdToken();
          const profile = await loadUserProfile(firebaseUser.uid, token);
          setUser(profile);
          setNeedsProfile(!profile);
          setAuthError(null);
        } catch (e) {
          console.error(e);
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('Admin') || msg.includes('private key')) {
            setAuthError(
              'Clé serveur manquante dans .env.local (FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY). Redémarrez npm run dev.'
            );
          } else {
            setAuthError(
              'Profil introuvable. Utilisez « Finaliser votre compte » ou republiez les règles Firestore.'
            );
          }
          setUser(null);
          setNeedsProfile(true);
        }
        setLoading(false);
      },
      (error) => {
        clearTimeout(timeout);
        console.error(error);
        setAuthError(error.message);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsub();
    };
  }, [pathname, router]);

  return (
    <AuthContext.Provider
      value={{ user, loading, needsProfile, authError, setUser, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
