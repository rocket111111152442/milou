"use client";
import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  CreditCard,
  History,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@waverti/ui";
import { AppShell, type NavItem } from "@waverti/ui/app";
import { clearServiceWorkerCaches } from "@/components/pwa/register-sw";

export function DashboardShell({
  children,
  email,
  displayName,
  isAdmin,
  unread,
}: {
  children: React.ReactNode;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  unread: number;
}) {
  const pathname = usePathname();
  // Le formulaire reste hors du menu : le menu se démonte à la sélection, ce qui annulerait l'envoi.
  const logoutForm = useRef<HTMLFormElement>(null);
  const active = (href: string, exact = false) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const nav: NavItem[] = [
    { href: "/app", label: "Vue d'ensemble", icon: <LayoutDashboard />, active: active("/app", true) },
    {
      href: "/app/surveillances",
      label: "Mes surveillances",
      icon: <ListChecks />,
      active: active("/app/surveillances") && !active("/app/surveillances/nouvelle"),
    },
    { href: "/app/surveillances/nouvelle", label: "Nouvelle surveillance", icon: <Plus />, active: active("/app/surveillances/nouvelle") },
    { href: "/app/alertes", label: "Alertes", icon: <Bell />, active: active("/app/alertes"), badge: unread },
    { href: "/app/historique", label: "Historique", icon: <History />, active: active("/app/historique") },
    { href: "/app/business", label: "Business", icon: <Building2 />, active: active("/app/business") },
  ];
  const secondary: NavItem[] = [
    { href: "/app/abonnement", label: "Abonnement", icon: <CreditCard />, active: active("/app/abonnement") },
    { href: "/app/parametres", label: "Paramètres", icon: <Settings />, active: active("/app/parametres") },
    { href: "/app/aide", label: "Aide", icon: <LifeBuoy />, active: active("/app/aide") },
    ...(isAdmin ? [{ href: "/admin", label: "Administration", icon: <ShieldCheck />, active: false }] : []),
  ];
  const initial = (displayName ?? email).slice(0, 1).toUpperCase();
  return (
    <AppShell
      nav={nav}
      secondaryNav={secondary}
      renderLink={({ href, className, children, onClick, ...rest }) => (
        <Link href={href} className={className} onClick={onClick} aria-current={rest["aria-current"]}>
          {children}
        </Link>
      )}
      header={
        <>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/app/surveillances/nouvelle">
              <Plus aria-hidden="true" /> Nouvelle surveillance
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full border border-line bg-white font-display text-sm font-bold hover:bg-surface"
                aria-label="Menu du compte"
              >
                {initial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-medium">{displayName ?? "Mon compte"}</p>
                <p className="truncate text-xs text-muted-fg">{email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/parametres">
                  <Settings /> Paramètres
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/abonnement">
                  <CreditCard /> Abonnement
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
        </>
      }
    >
      {children}
    </AppShell>
  );
}
