import type { Metadata } from "next";
import { FaqSection } from "@/components/marketing/faq";
import { PricingSection, planOrder } from "@/components/marketing/pricing";
import { getPublicPlans } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Formules Watchly : Plus 5,99 €/mois, Pro 14,99 €/mois et Business 39,99 €/mois, sans engagement. Chaque formule s'essaie gratuitement pendant 3 jours.",
  alternates: { canonical: "/tarifs" },
};

export const revalidate = 600;

export default async function TarifsPage() {
  const plans = await getPublicPlans();
  return (
    <>
      <PricingSection plans={planOrder(plans)} standalone />
      <FaqSection />
    </>
  );
}
