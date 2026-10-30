"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Coins, Gauge, LifeBuoy, ScrollText, Users } from "lucide-react";
import { Badge } from "@waverti/ui";
import { AppShell, type NavItem } from "@waverti/ui/app";
import { NextLink } from "@/components/app/next-link";

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const is = (href: string, exact = false) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const nav: NavItem[] = [
    { href: "/admin", label: "Vue d'ensemble", icon: <Gauge />, active: is("/admin", true) },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: <Users />, active: is("/admin/utilisateurs") },
    { href: "/admin/support", label: "Assistance", icon: <LifeBuoy />, active: is("/admin/support") },
    { href: "/admin/couts", label: "Coûts", icon: <Coins />, active: is("/admin/couts") },
    { href: "/admin/journal", label: "Journal d'audit", icon: <ScrollText />, active: is("/admin/journal") },
  ];
  return (
    <AppShell
      nav={nav}
      secondaryNav={[{ href: "/app", label: "Retour à l'application", icon: <ArrowLeft /> }]}
      renderLink={NextLink}
      homeHref="/admin"
      header={
        <div className="flex items-center gap-3 text-sm">
          <Badge tone="warning">Administration LULLIN WEB</Badge>
          <span className="hidden text-muted-fg sm:inline">{email}</span>
          <Link href="/app" className="sr-only">
            Application
          </Link>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
