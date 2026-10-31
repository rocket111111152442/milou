import { AppShowcase } from "@/components/marketing/app-showcase";
import { DownloadSection } from "@/components/marketing/download";
import { FaqSection, faqItems } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { InteractiveDemo } from "@/components/marketing/interactive-demo";
import { PricingSection, planOrder } from "@/components/marketing/pricing";
import {
  BusinessSection,
  FinalCta,
  HowItWorks,
  PageMonitoring,
  WebSearchSection,
} from "@/components/marketing/sections";
import { getPublicPlans } from "@/lib/plans";
import { getPublishedReleases } from "@/lib/releases";
import { siteConfig } from "@/lib/site";

export const revalidate = 600;

export default async function HomePage() {
  const [plans, releases] = await Promise.all([getPublicPlans(), getPublishedReleases()]);
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
      mainEntity: faqItems.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero />
      <HowItWorks />
      <PageMonitoring />
      <WebSearchSection />
      <BusinessSection />
      <InteractiveDemo />
      <AppShowcase />
      <DownloadSection releases={releases} />
      <PricingSection plans={planOrder(plans)} />
      <FaqSection />
      <FinalCta />
    </>
  );
}
