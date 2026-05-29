'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/create', label: 'Créer' },
  { href: '/transfer', label: 'Transfert' },
  { href: '/profile', label: 'Profil' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-milou-border bg-milou-bg/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
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
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className={`px-3 py-2 rounded-lg text-sm ${
                pathname === '/admin' ? 'text-violet-400 bg-violet-500/10' : 'text-violet-400'
              }`}
            >
              Admin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-semibold text-sm hidden sm:block">
            {user.balance.toFixed(2)} M
          </span>
          <button onClick={logout} className="btn-secondary text-sm py-1.5 px-3">
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
      </div>
    </nav>
  );
}
