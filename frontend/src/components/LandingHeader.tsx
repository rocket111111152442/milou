'use client';

import Link from 'next/link';
import { useState } from 'react';

const NAV_LINKS = [
  { href: '#pourquoi', label: 'Pourquoi MILOU' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#comment', label: 'Comment ça marche' },
];

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-milou-border bg-milou-bg/90 backdrop-blur-md safe-top">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent shrink-0"
          >
            MILOU
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-400">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-cyan-400 transition whitespace-nowrap">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login" className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-5">
              Connexion
            </Link>
            <Link href="/register" className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-5">
              <span className="sm:hidden">Inscription</span>
              <span className="hidden sm:inline">S&apos;inscrire</span>
            </Link>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg border border-milou-border text-gray-300 hover:border-cyan-500/50"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden border-t border-milou-border py-4 flex flex-col gap-3">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-gray-300 hover:text-cyan-400 py-1"
                onClick={closeMenu}
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/register"
              className="btn-primary text-center mt-2"
              onClick={closeMenu}
            >
              S&apos;inscrire gratuitement
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
