import type { Metadata } from "next";
import { FaqList } from "@/components/site/FaqList";
import { PageHero } from "@/components/site/PageHero";
import { getFaqs } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Questions fréquentes" };

export default async function FaqPage() {
  const faqs = await getFaqs();
  const cats = Array.from(new Set(faqs.map((f) => f.category)));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero eyebrow="Questions fréquentes" title="Tout ce que" accent="vous voulez savoir" crumbs={[{ href: "/faq", label: "FAQ" }]} compact />
      <section className="fern-paper bg-ivory py-24 text-noir">
        <div className="mx-auto max-w-[1100px] space-y-16 px-6 sm:px-10">
          {cats.map((c) => (
            <div key={c}>
              <p className="eyebrow mb-4 text-aubergine-600">{c}</p>
              <FaqList faqs={faqs.filter((f) => f.category === c)} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
