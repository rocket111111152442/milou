"use client";
import { useRef } from "react";
import Link from "next/link";
import { CreditCard, LifeBuoy, LogOut, Repeat, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Logo } from "@waverti/ui";
import { clearServiceWorkerCaches } from "@/components/pwa/register-sw";

/**
 * Coque d'un compte SANS formule active : aucun menu de navigation (il n'y a encore rien à gérer), seulement le logo et le menu du compte
 * (paramètres, aide, changer de compte). Le menu complet apparaît dès qu'une formule, un essai ou un accès bêta est actif.
 */
export function LockedShell({ children, email, displayName }: { children: React.ReactNode; email: string; displayName: string | null }) {
  const logoutForm = useRef<HTMLFormElement>(null);
  const switchForm = useRef<HTMLFormElement>(null);
  const initial = (displayName ?? email).slice(0, 1).toUpperCase();
  return (
    <div className="app-canvas min-h-dvh">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/55 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/app/abonnement" aria-label="Waverti — accueil">
            <Logo />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-full border border-line bg-white/80 py-1 pl-1 pr-3.5 text-sm font-medium hover:bg-white"
                aria-label="Menu du compte"
              >
                <span className="grid size-8 place-items-center rounded-full bg-[linear-gradient(135deg,#1d3fd6,#8028ff)] font-display text-xs font-bold text-white">{initial}</span>
                <span className="hidden max-w-[180px] truncate sm:inline">{displayName ?? email}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-medium">{displayName ?? "Mon compte"}</p>
                <p className="truncate text-xs text-muted-fg">{email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/abonnement">
                  <CreditCard /> Choisir une formule
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/parametres">
                  <Settings /> Paramètres
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/aide">
                  <LifeBuoy /> Aide
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  clearServiceWorkerCaches();
                  switchForm.current?.requestSubmit();
                }}
              >
                <Repeat /> Changer de compte
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  clearServiceWorkerCaches();
                  logoutForm.current?.requestSubmit();
                }}
              >
                <LogOut /> Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <form ref={logoutForm} action="/auth/deconnexion" method="post" hidden />
          <form ref={switchForm} action="/auth/deconnexion?vers=connexion" method="post" hidden />
        </div>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
