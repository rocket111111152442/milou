import type { Metadata } from "next";
import { FaqSection } from "@/components/marketing/faq";
import { PricingSection, planOrder } from "@/components/marketing/pricing";
import { getPublicPlans } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Formules Watchly : Découverte gratuite, Plus 5,99 €/mois, Pro 14,99 €/mois et Business 39,99 €/mois. Essai de 72 heures sur les formules payantes.",
  alternates: { canonical: "/tarifs" },
};

export const revalidate = 600;

export default async function TarifsPage() {
  const plans = await getPublicPlans();
  return (
    <>
      <PricingSection plans={planOrder(plans)} />
      <FaqSection />
    </>
  );
}
