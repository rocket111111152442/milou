import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PLAN_CATALOG } from "@waverti/billing/catalog";
import { requireUser } from "@/lib/auth";
import { listDevices, loadEntitlements } from "@/lib/data/account";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function WelcomePage() {
  const user = await requireUser("/app/bienvenue");
  const [ent, devices] = await Promise.all([loadEntitlements(user.id), listDevices(user.id)]);
  // Sans abonnement ni essai, la première étape est le choix d'une formule (aucune formule gratuite).
  if (!ent.planId) redirect("/app/abonnement?bienvenue=1#formules");
  return (
    <Onboarding
      displayName={user.displayName}
      hasDevice={devices.length > 0}
      entitlements={{
        pageIntervalMinutes: ent.pageIntervalMinutes,
        webIntervalMinutes: ent.webIntervalMinutes,
        maxWebTopics: ent.maxWebTopics,
        cloudRelay: ent.cloudRelay,
        emailAlerts: ent.emailAlerts,
        planName: PLAN_CATALOG[ent.planId as keyof typeof PLAN_CATALOG]?.name ?? null,
        maxMonitors: ent.maxMonitors,
        businessSites: ent.businessSites,
      }}
    />
  );
}
