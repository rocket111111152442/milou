"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Tableau de bord", e: "🏠" },
  { href: "/admin/activites", label: "Activités & horaires", e: "🎨" },
  { href: "/admin/blog", label: "Blog / News", e: "📰" },
  { href: "/admin/demandes", label: "Demandes reçues", e: "📬" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <aside className="sticky top-0 z-20 border-b border-ink/10 bg-white lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-3 p-4 lg:block lg:p-6">
        <Link href="/admin">
          <Image src="/images/logo-horizontal.webp" alt="Chouet'House" width={160} height={37} className="h-8 w-auto" />
        </Link>
        <p className="hidden text-xs font-bold tracking-wider text-ink-soft uppercase lg:mt-2 lg:block">Espace admin</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-4">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 font-bold whitespace-nowrap transition ${active ? "bg-sage-deep text-white" : "hover:bg-cream"}`}
            >
              <span>{l.e}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden space-y-2 p-4 lg:absolute lg:bottom-0 lg:block lg:w-full">
        <Link href="/" target="_blank" className="block rounded-2xl px-4 py-2 text-sm font-bold hover:bg-cream">↗ Voir le site</Link>
        <button
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            router.replace("/admin/login");
          }}
          className="w-full rounded-2xl px-4 py-2 text-left text-sm font-bold text-tomato hover:bg-shell"
        >
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
