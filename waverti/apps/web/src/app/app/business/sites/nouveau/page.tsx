import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@waverti/ui";
import { requireUser } from "@/lib/auth";
import { NewSiteForm } from "./new-site-form";

export const metadata: Metadata = { title: "Ajouter un site" };

export default async function NewSitePage() {
  await requireUser("/app/business/sites/nouveau");
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-fg">
        <Link href="/app/business" className="hover:text-ink">
          Business
        </Link>{" "}
        / <span aria-current="page">Ajouter un site</span>
      </nav>
      <PageHeader
        title="Ajouter votre site professionnel"
        description="Vous devrez ensuite prouver que vous en êtes propriétaire (enregistrement DNS ou fichier sur le site) : Waverti ne contrôle que les sites vérifiés."
      />
      <NewSiteForm />
    </div>
  );
}
