import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listDevices, loadEntitlements } from "@/lib/data/account";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function WelcomePage() {
  const user = await requireUser("/app/bienvenue");
  const [ent, devices] = await Promise.all([loadEntitlements(user.id), listDevices(user.id)]);
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
      }}
    />
  );
}
