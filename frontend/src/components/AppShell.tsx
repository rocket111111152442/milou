'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  IconGift,
  IconHome,
  IconPlus,
  IconSend,
  IconShield,
  IconStar,
  IconStore,
  IconUser,
} from '@/components/ui/Icons';

const SIDE_LINKS = [
  { href: '/dashboard', label: 'Tableau de bord', icon: IconHome },
  { href: '/marketplace', label: 'Marketplace', icon: IconStore },
  { href: '/create', label: 'Nouvelle annonce', icon: IconPlus },
  { href: '/transfer', label: 'Envoyer des M', icon: IconSend },
  { href: '/transactions', label: 'Historique M', icon: IconSend },
  { href: '/codes', label: 'Codes cadeaux', icon: IconGift },
  { href: '/premium', label: 'Premium', icon: IconStar, hideIfPremium: true },
  { href: '/profile', label: 'Mon profil', icon: IconUser },
];

const INFO_LINKS = [
  { href: '/how-it-works', label: 'Comment ça marche' },
  { href: '/rules', label: 'Règles' },
  { href: '/faq', label: 'FAQ' },
];

interface Props {
  children: ReactNode;
  sidebarExtra?: ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

export default function AppShell({ children, sidebarExtra, title, subtitle, headerRight }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="app-shell min-h-[calc(100vh-3.75rem)]">
      <aside className="app-sidebar hidden lg:flex flex-col gap-5 p-4 border-r border-white/[0.06]">
        <nav className="space-y-0.5">
          {SIDE_LINKS.map((l) => {
            if (l.hideIfPremium && user?.isPremium) return null;
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}
              >
                <l.icon className="w-5 h-5 shrink-0 opacity-80" />
                <span>{l.label}</span>
              </Link>
            );
          })}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <Link
              href="/admin"
              className={`sidebar-link ${pathname === '/admin' ? 'sidebar-link-active' : ''}`}
            >
              <IconShield className="w-5 h-5 shrink-0" />
              <span>Modération</span>
            </Link>
          )}
        </nav>

        <div className="space-y-0.5">
          <p className="sidebar-section-title px-3">Transparence</p>
          {INFO_LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`sidebar-link text-sm ${active ? 'sidebar-link-active' : ''}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {sidebarExtra}

        {user && (
          <div className="mt-auto p-4 rounded-2xl bg-milou-card border border-white/[0.06]">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Solde</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-0.5">
              {user.balance.toFixed(2)} <span className="text-sm text-zinc-500 font-medium">M</span>
            </p>
            <p className="text-xs text-zinc-500 truncate mt-2">
              {user.firstname} {user.lastname}
            </p>
          </div>
        )}
      </aside>

      <div className="app-main flex-1 min-w-0">
        {(title || headerRight) && (
          <header className="page-header px-4 sm:px-6 py-6 sm:py-8">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                {title && <h1 className="page-title">{title}</h1>}
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
              </div>
              {headerRight && <div className="flex flex-wrap gap-2">{headerRight}</div>}
            </div>
          </header>
        )}
        <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">{children}</div>
      </div>
    </div>
  );
}
