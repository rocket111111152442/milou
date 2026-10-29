import type { Metadata } from "next";
import { PageHeader } from "@watchly/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Business" };

/** Remplacé par le tableau de bord Business complet (phase I). */
export default async function BusinessPage() {
  await requireUser("/app/business");
  return <PageHeader title="Business" description="Chargement du module Business." />;
}
