import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Button, Callout, Card, EmptyState, PageHeader } from "@watchly/ui";
import { IncidentList, SiteList } from "@watchly/ui/app";
import { requireUser } from "@/lib/auth";
import { loadEntitlements } from "@/lib/data/account";
import { listIncidents, listSites } from "@/lib/data/business";
import { NextLink } from "@/components/app/next-link";

export const metadata: Metadata = { title: "Business" };

export default async function BusinessPage() {
  const user = await requireUser("/app/business");
  const ent = await loadEntitlements(user.id);
  if (ent.businessSites === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Surveillance de votre site professionnel" />
        <EmptyState
          icon={<Building2 />}
          title="Fonction incluse dans la formule Business"
          description="Contrôle de disponibilité à la minute, vérification du certificat HTTPS, scénario de parcours dans un vrai navigateur, alertes prioritaires et rapports. Uniquement pour un site dont vous prouvez la propriété."
          action={
            <Button asChild>
              <Link href="/app/abonnement">Voir la formule Business</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const [sites, incidents] = await Promise.all([listSites(user.id), listIncidents(user.id, { limit: 20 })]);
  const canAdd = sites.length < ent.businessSites;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Business"
        description={`${sites.length} site(s) sur ${ent.businessSites} inclus dans votre abonnement.`}
        actions={
          canAdd ? (
            <Button asChild>
              <Link href="/app/business/sites/nouveau">
                <Plus aria-hidden="true" /> Ajouter un site
              </Link>
            </Button>
          ) : null
        }
      />
      {!canAdd && sites.length > 0 ? (
        <Callout tone="neutral">
          Tous les sites inclus sont utilisés. Un site supplémentaire coûte 14,99 € par mois :{" "}
          <Link className="font-medium text-blue hover:underline" href="/app/abonnement">
            gérer l'abonnement
          </Link>
          .
        </Callout>
      ) : null}
      <SiteList
        sites={sites}
        hrefFor={(s) => `/app/business/sites/${s.id}`}
        renderLink={NextLink}
        emptyAction={
          <Button asChild>
            <Link href="/app/business/sites/nouveau">Ajouter mon site</Link>
          </Button>
        }
      />
      <section className="flex flex-col gap-3" aria-labelledby="incidents-title">
        <h2 id="incidents-title" className="font-display text-lg font-bold">
          Incidents récents
        </h2>
        <Card className="p-2">
          <IncidentList incidents={incidents} hrefFor={(i) => `/app/business/incidents/${i.id}`} renderLink={NextLink} />
        </Card>
      </section>
    </div>
  );
}
