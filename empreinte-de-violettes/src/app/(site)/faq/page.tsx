import type { Metadata } from "next";
import Link from "next/link";
import { RunningHead } from "@/components/herbier/Elements";
import { FaqList } from "@/components/herbier/FaqList";
import { PageHead } from "@/components/herbier/PageHead";
import { getFaqs, getSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Questions fréquentes" };

export default async function FaqPage() {
  const [faqs, settings] = await Promise.all([getFaqs(), getSettings()]);
  const cats = Array.from(new Set(faqs.map((f) => f.category)));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  let n = 1;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHead kicker="Questions fréquentes" folio={`${faqs.length} entrées`} title="Bon" accent="à savoir" intro="Livraison, retrait, message, mariage, entretien : les réponses aux questions qu'on nous pose le plus souvent." plate="fougere" />
      <section className="wrap space-y-16 pb-24">
        {cats.map((c) => {
          const items = faqs.filter((f) => f.category === c);
          const start = n;
          n += items.length;
          return (
            <div key={c}>
              <RunningHead left={c} />
              <div className="mt-6">
                <FaqList faqs={items} start={start} />
              </div>
            </div>
          );
        })}
        <p className="font-text text-[1.05rem] italic text-ink-soft">
          Une autre question ? Appelez-nous au <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="ulink-on tab not-italic">{settings.phone}</a> ou{" "}
          <Link href="/contact" className="ulink-on">
            écrivez-nous
          </Link>
          .
        </p>
      </section>
    </>
  );
}
