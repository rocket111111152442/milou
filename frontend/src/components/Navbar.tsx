'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { presenceApi } from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';
import PremiumBadge from '@/components/PremiumBadge';
import AdminBadge from '@/components/AdminBadge';
import MilouLogo from '@/components/ui/MilouLogo';
import {
  IconClose,
  IconGift,
  IconHome,
  IconMenu,
  IconPlus,
  IconSend,
  IconShield,
  IconStar,
  IconStore,
  IconUser,
} from '@/components/ui/Icons';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: IconHome },
  { href: '/marketplace', label: 'Marketplace', icon: IconStore },
  { href: '/create', label: 'Créer', icon: IconPlus },
  { href: '/transfer', label: 'Transfert', icon: IconSend },
  { href: '/codes', label: 'Codes', icon: IconGift },
  { href: '/profile', label: 'Profil', icon: IconUser },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    presenceApi.heartbeat().catch(() => {});
    const t = setInterval(() => presenceApi.heartbeat().catch(() => {}), 120000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!user) return null;

  const isStaff = user.role === 'admin' || user.role === 'moderator';

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-milou-bg/85 backdrop-blur-xl">
      <div className="max-w-[1440px] mx-auto px-4 h-[3.75rem] flex items-center justify-between gap-3">
        <MilouLogo size="sm" href="/dashboard" />

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'text-white bg-white/[0.06]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {!user.isPremium && (
            <Link
              href="/premium"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                pathname === '/premium'
                  ? 'text-amber-300 bg-amber-500/10'
                  : 'text-amber-400/90 hover:bg-amber-500/10'
              }`}
            >
              <IconStar className="w-3.5 h-3.5" />
              Premium
            </Link>
          )}
          {isStaff && (
            <Link
              href="/admin"
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                pathname === '/admin' ? 'text-indigo-300 bg-indigo-500/10' : 'text-indigo-400 hover:bg-indigo-500/10'
              }`}
            >
              <IconShield className="w-3.5 h-3.5" />
              Modération
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user.role === 'admin' && <AdminBadge />}
          {user.isPremium && <PremiumBadge />}
          <NotificationBell />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-milou-surface border border-white/[0.06]">
            <span className="text-xs text-zinc-500">Solde</span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">
              {user.balance.toFixed(2)} M
            </span>
          </div>
          <button type="button" onClick={logout} className="btn-secondary text-xs py-1.5 px-3 hidden sm:inline-flex">
            Déconnexion
          </button>
          <button
            type="button"
            className="md:hidden p-2 rounded-xl border border-white/10 text-zinc-300"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
          >
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-milou-surface/95 backdrop-blur-xl px-4 py-4 space-y-1 animate-fade-in safe-bottom">
          <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-xl bg-milou-card border border-white/[0.06]">
            <span className="text-xs text-zinc-500">Solde</span>
            <span className="font-bold text-emerald-400 tabular-nums">{user.balance.toFixed(2)} M</span>
          </div>
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm ${
                  active ? 'bg-indigo-500/10 text-white border border-indigo-500/20' : 'text-zinc-400'
                }`}
              >
                <l.icon className="w-5 h-5" />
                {l.label}
              </Link>
            );
          })}
          {!user.isPremium && (
            <Link href="/premium" className="flex items-center gap-3 px-3 py-3 rounded-xl text-amber-400 text-sm">
              <IconStar className="w-5 h-5" />
              Premium
            </Link>
          )}
          {isStaff && (
            <Link href="/admin" className="flex items-center gap-3 px-3 py-3 rounded-xl text-indigo-400 text-sm">
              <IconShield className="w-5 h-5" />
              Modération
            </Link>
          )}
          <button type="button" onClick={logout} className="btn-secondary w-full mt-2">
            Déconnexion
          </button>
        </div>
      )}
    </nav>
  );
}
