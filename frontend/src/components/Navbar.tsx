'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { presenceApi } from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';
import PremiumBadge from '@/components/PremiumBadge';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/create', label: 'Créer' },
  { href: '/transfer', label: 'Transfert' },
  { href: '/codes', label: 'Codes' },
  { href: '/profile', label: 'Profil' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return;
    presenceApi.heartbeat().catch(() => {});
    const t = setInterval(() => presenceApi.heartbeat().catch(() => {}), 120000);
    return () => clearInterval(t);
  }, [user]);

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-milou-border bg-milou-bg/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <Link
          href="/dashboard"
          className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent shrink-0"
        >
          MILOU
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2 rounded-lg text-sm transition ${
                pathname === l.href
                  ? 'text-cyan-400 bg-cyan-500/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}
          {!user.isPremium && (
            <Link
              href="/premium"
              className={`px-3 py-2 rounded-lg text-sm text-amber-400 hover:bg-amber-500/10 ${
                pathname === '/premium' ? 'bg-amber-500/10' : ''
              }`}
            >
              Premium
            </Link>
          )}
          {(user.role === 'admin' || user.role === 'moderator') && (
            <Link
              href="/admin"
              className={`px-3 py-2 rounded-lg text-sm ${
                pathname === '/admin' ? 'text-violet-400 bg-violet-500/10' : 'text-violet-400'
              }`}
            >
              Modération
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {user.isPremium && <PremiumBadge />}
          <NotificationBell />
          <span className="text-cyan-400 font-semibold text-sm hidden sm:block">
            {user.balance.toFixed(2)} M
          </span>
          <button type="button" onClick={logout} className="btn-secondary text-sm py-1.5 px-3">
            Déconnexion
          </button>
        </div>
      </div>
      <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2 border-t border-milou-border/50">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-xs whitespace-nowrap px-2 py-1 text-gray-400">
            {l.label}
          </Link>
        ))}
        {!user.isPremium && (
          <Link href="/premium" className="text-xs whitespace-nowrap px-2 py-1 text-amber-400">
            Premium
          </Link>
        )}
      </div>
    </nav>
  );
}
