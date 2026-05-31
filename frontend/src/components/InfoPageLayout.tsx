'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';

const INFO_LINKS = [
  { href: '/how-it-works', label: 'Comment ça marche' },
  { href: '/rules', label: 'Règles' },
  { href: '/faq', label: 'FAQ' },
];

export default function InfoPageLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      <main className="max-w-3xl mx-auto px-4 py-10">
        <nav className="flex flex-wrap gap-3 mb-8 text-sm">
          {INFO_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-indigo-400 hover:text-indigo-300">
              {l.label}
            </Link>
          ))}
          <Link href="/marketplace" className="text-zinc-500 hover:text-zinc-300">
            Marketplace
          </Link>
        </nav>
        <h1 className="text-3xl font-bold text-white mb-6">{title}</h1>
        <div className="prose prose-invert prose-sm max-w-none space-y-4 text-zinc-300">{children}</div>
      </main>
    </>
  );
}
