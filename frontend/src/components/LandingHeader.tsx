'use client';

import Link from 'next/link';
import { useState } from 'react';
import MilouLogo from '@/components/ui/MilouLogo';
import { IconMenu, IconClose, IconArrowRight } from '@/components/ui/Icons';

const NAV_LINKS = [
  { href: '#pourquoi', label: 'Pourquoi MILOU' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#comment', label: 'Comment ça marche' },
];

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-milou-bg/80 backdrop-blur-xl safe-top">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-14 sm:h-16 flex items-center justify-between gap-4">
          <MilouLogo size="md" />

          <nav className="hidden lg:flex items-center gap-8 text-sm text-zinc-400">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-white transition">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="btn-ghost hidden sm:inline-flex text-sm">
              Connexion
            </Link>
            <Link href="/register" className="btn-primary text-sm py-2 px-4 sm:px-5">
              Commencer
            </Link>
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Fermer' : 'Menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden border-t border-white/[0.06] py-4 flex flex-col gap-1 animate-fade-in">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-2.5 rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white transition"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <Link href="/login" className="px-3 py-2.5 text-zinc-400" onClick={() => setMenuOpen(false)}>
              Connexion
            </Link>
            <Link
              href="/register"
              className="btn-primary text-center mt-2 flex items-center justify-center gap-2"
              onClick={() => setMenuOpen(false)}
            >
              Commencer gratuitement
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
