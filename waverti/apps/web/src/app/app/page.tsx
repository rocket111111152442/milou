import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Callout, PageHeader } from "@waverti/ui";
import { OverviewView } from "@waverti/ui/app";
import { requireUser } from "@/lib/auth";
import { getOverview } from "@/lib/data/monitors";
import { NextLink } from "@/components/app/next-link";

export const metadata: Metadata = { title: "Vue d'ensemble" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ "mot-de-passe"?: string }> }) {
  const user = await requireUser("/app");
  if (!user.onboardingCompletedAt) redirect("/app/bienvenue");
  const sp = await searchParams;
  const { data, cloudRelay } = await getOverview(user.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Bonjour${user.displayName ? ` ${user.displayName}` : ""}`}
        description="Voici l'état de vos surveillances."
        actions={
          <Button asChild>
            <Link href="/app/surveillances/nouvelle">
              <Plus aria-hidden="true" /> Nouvelle surveillance
            </Link>
          </Button>
        }
      />
      {sp["mot-de-passe"] === "modifie" ? <Callout tone="success">Votre mot de passe a été modifié.</Callout> : null}
      <OverviewView data={data} cloudRelay={cloudRelay} renderLink={NextLink} />
    </div>
  );
}
