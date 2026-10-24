import type { Metadata } from "next";
import { LegalPage } from "@/components/herbier/LegalPage";
import { getContent } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Politique de confidentialité" };

export default async function Page() {
  const content = await getContent();
  return <LegalPage title="Politique de confidentialité" text={content.legal.privacy} />;
}
