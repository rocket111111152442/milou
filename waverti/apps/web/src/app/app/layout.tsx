import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { loadEntitlements, unreadCount } from "@/lib/data/account";
import { NetworkStatus } from "@/components/pwa/network-status";
import { AppearanceBoot } from "@/components/app/appearance";
import { LockedShell } from "@/components/app/locked-shell";
import { DashboardShell } from "./shell";

// Espace privé : toujours rendu à la requête (session, données personnelles), jamais mis en cache statique.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Tableau de bord", template: "%s · Waverti" }, robots: { index: false } };

/** Pages accessibles sans formule : choix de la formule et facturation, paramètres du compte, aide, liaison d'un appareil. */
const UNLOCKED_PATHS = ["/app/abonnement", "/app/parametres", "/app/aide", "/app/bienvenue", "/app/appareils"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app");
  const current = await getCurrentUser();
  const isAdmin = current?.role === "admin";

  // Compte sans formule (ni essai, ni accès bêta) : aucun menu, uniquement le choix d'une formule, les paramètres et l'aide.
  // Le menu complet apparaît dès qu'une formule est active. Les administrateurs ne sont jamais verrouillés.
  const ent = isAdmin ? null : await loadEntitlements(user.id).catch(() => null);
  if (ent && !ent.planId) {
    const path = ((await headers()).get("x-waverti-path") ?? "").split("?")[0] ?? "";
    const allowed = UNLOCKED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
    if (path && !allowed) redirect("/app/abonnement?bienvenue=1");
    return (
      <LockedShell email={user.email} displayName={user.displayName}>
        <AppearanceBoot />
        <NetworkStatus />
        {children}
      </LockedShell>
    );
  }

  const unread = await unreadCount(user.id).catch(() => 0);
  return (
    <DashboardShell email={user.email} displayName={user.displayName} isAdmin={isAdmin} unread={unread}>
      <AppearanceBoot />
      <NetworkStatus />
      {children}
    </DashboardShell>
  );
}
