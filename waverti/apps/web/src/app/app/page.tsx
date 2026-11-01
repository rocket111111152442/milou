import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Callout } from "@waverti/ui";
import { DashboardView } from "@waverti/ui/app";
import { requireUser } from "@/lib/auth";
import { getOverview } from "@/lib/data/monitors";
import { NextLink } from "@/components/app/next-link";

export const metadata: Metadata = { title: "Accueil" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ "mot-de-passe"?: string }> }) {
  const user = await requireUser("/app");
  if (!user.onboardingCompletedAt) redirect("/app/bienvenue");
  const sp = await searchParams;
  const { data, cloudRelay } = await getOverview(user.id);
  return (
    <div className="flex flex-col gap-6">
      {sp["mot-de-passe"] === "modifie" ? <Callout tone="success">Votre mot de passe a été modifié.</Callout> : null}
      <DashboardView data={data} userName={user.displayName} cloudRelay={cloudRelay} renderLink={NextLink} />
    </div>
  );
}
