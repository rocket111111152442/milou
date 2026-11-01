import { FaqSection } from "@/components/marketing/faq";
import { HomeBusiness, HomeFinalCta, HomeHero, HomeHowItWorks, HomePricing, HomeUses, homeFaq } from "@/components/marketing/home";
import { getPublicPlans } from "@/lib/plans";
import { siteConfig } from "@/lib/site";

export const revalidate = 600;

export default async function HomePage() {
  const plans = await getPublicPlans();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Waverti",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Windows, macOS, Linux, Web",
      description: siteConfig.description,
      publisher: { "@type": "Organization", name: siteConfig.publisher, url: siteConfig.publisherUrl },
      offers: plans.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: (p.priceCents / 100).toFixed(2),
        priceCurrency: "EUR",
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: homeFaq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <HomeHero />
      <HomeHowItWorks />
      <HomeUses />
      <HomeBusiness />
      <HomePricing />
      <FaqSection items={homeFaq} title="Les réponses essentielles" compact />
      <HomeFinalCta />
    </>
  );
}
