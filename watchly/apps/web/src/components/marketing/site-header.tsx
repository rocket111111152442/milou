"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button, Logo, cn } from "@watchly/ui";
import { mainNav } from "@/lib/site";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300",
        scrolled || open ? "border-line bg-white/90 backdrop-blur-md" : "border-transparent bg-white/0",
      )}
    >
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Watchly, accueil" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Navigation principale" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {signedIn ? (
            <Button asChild size="md">
              <Link href="/app">Mon tableau de bord</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/connexion">Connexion</Link>
              </Button>
              <Button asChild>
                <Link href="/inscription">Commencer</Link>
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          className="ml-auto grid size-11 place-items-center rounded-full text-ink hover:bg-surface lg:hidden"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open ? (
        <div id="menu-mobile" className="h-[calc(100dvh-72px)] overflow-y-auto border-t border-line bg-white px-4 pb-8 pt-4 lg:hidden">
          <nav aria-label="Navigation mobile" className="flex flex-col">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-4 font-display text-lg font-semibold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            {signedIn ? (
              <Button asChild size="lg">
                <Link href="/app" onClick={() => setOpen(false)}>
                  Mon tableau de bord
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/inscription" onClick={() => setOpen(false)}>
                    Commencer gratuitement
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/connexion" onClick={() => setOpen(false)}>
                    Connexion
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
