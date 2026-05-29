'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase/client';
import { User } from '@/lib/types';
import { authApi } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const PUBLIC_PATHS = ['/', '/login', '/register'];

async function loadUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    firstname: d.firstname,
    lastname: d.lastname,
    email: d.email,
    balance: d.balance ?? 0,
    role: d.role ?? 'user',
    reputation: d.reputation ?? 0,
    totalEarned: d.totalEarned ?? 0,
    totalSpent: d.totalSpent ?? 0,
    transactionCount: d.transactionCount ?? 0,
    createdAt: d.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    if (isFirebaseConfigured()) await signOut(getFirebaseAuth());
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth.currentUser) return;
    try {
      if (isFirebaseConfigured()) {
        const u = await loadUserProfile(firebaseAuth.currentUser.uid);
        setUser(u);
      } else {
        const { user: u } = await authApi.me();
        setUser(u);
      }
    } catch {
      await logout();
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        if (!PUBLIC_PATHS.includes(pathname)) router.push('/login');
        return;
      }
      const profile = await loadUserProfile(firebaseUser.uid);
      setUser(profile);
      setLoading(false);
    });
    return () => unsub();
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
