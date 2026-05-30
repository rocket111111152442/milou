'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

const SIDE_LINKS = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '🏠', color: 'from-cyan-500/20 to-cyan-600/5' },
  { href: '/marketplace', label: 'Marketplace', icon: '🛒', color: 'from-violet-500/20 to-violet-600/5' },
  { href: '/create', label: 'Nouvelle annonce', icon: '✨', color: 'from-pink-500/20 to-pink-600/5' },
  { href: '/transfer', label: 'Envoyer des M', icon: '💸', color: 'from-green-500/20 to-green-600/5' },
  { href: '/codes', label: 'Codes cadeaux', icon: '🎁', color: 'from-amber-500/20 to-orange-600/5' },
  { href: '/premium', label: 'Premium', icon: '⭐', color: 'from-amber-500/20 to-amber-600/5', premiumOnly: false },
  { href: '/profile', label: 'Mon profil', icon: '👤', color: 'from-blue-500/20 to-blue-600/5' },
];

interface Props {
  children: ReactNode;
  /** Contenu optionnel sous la nav (filtres marketplace, etc.) */
  sidebarExtra?: ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

export default function AppShell({ children, sidebarExtra, title, subtitle, headerRight }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="app-shell min-h-[calc(100vh-4rem)]">
      <aside className="app-sidebar hidden lg:flex flex-col gap-4 p-4 border-r border-milou-border/80 bg-milou-card/40">
        <div className="space-y-1">
          {SIDE_LINKS.map((l) => {
            if (l.href === '/premium' && user?.isPremium) return null;
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`sidebar-link ${active ? 'sidebar-link-active' : ''} bg-gradient-to-r ${l.color}`}
              >
                <span className="text-lg" aria-hidden>
                  {l.icon}
                </span>
                <span>{l.label}</span>
              </Link>
            );
          })}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <Link
              href="/admin"
              className={`sidebar-link ${pathname === '/admin' ? 'sidebar-link-active' : ''} bg-gradient-to-r from-red-500/15 to-orange-500/10`}
            >
              <span className="text-lg">🛡️</span>
              <span>Modération</span>
            </Link>
          )}
        </div>
        {sidebarExtra}
        {user && (
          <div className="mt-auto p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-pink-500/10 border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Solde</p>
            <p className="text-2xl font-bold text-cyan-400">{user.balance.toFixed(2)} M</p>
            <p className="text-xs text-gray-400 truncate mt-1">
              {user.firstname} {user.lastname}
            </p>
          </div>
        )}
      </aside>

      <div className="app-main flex-1 min-w-0">
        {(title || headerRight) && (
          <header className="page-header px-4 sm:px-6 py-6 border-b border-milou-border/50">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                {title && <h1 className="page-title">{title}</h1>}
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
              </div>
              {headerRight}
            </div>
          </header>
        )}
        <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">{children}</div>
      </div>
    </div>
  );
}
