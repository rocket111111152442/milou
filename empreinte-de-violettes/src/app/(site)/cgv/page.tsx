import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { getContent } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conditions générales de vente" };

export default async function Page() {
  const content = await getContent();
  return <LegalPage title="Conditions générales de vente" text={content.legal.cgv} href="/cgv" />;
}
