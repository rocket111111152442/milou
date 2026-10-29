import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Accordion, AccordionItem, Button, Container } from "@watchly/ui";
import { siteConfig } from "@/lib/site";

export interface SeoContent {
  slug: string;
  eyebrow: string;
  h1: string;
  intro: string;
  blocks: Array<{ title: string; body: string[]; list?: string[] }>;
  steps: string[];
  faqs: Array<{ q: string; a: string }>;
  cta: { label: string; href: string };
}

/** Gabarit des pages ciblées : chaque page porte un contenu propre (pas de pages quasi identiques). */
export function SeoPage({ content }: { content: SeoContent }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: content.h1,
        step: content.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
      },
      {
        "@type": "FAQPage",
        mainEntity: content.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: content.h1, item: `${siteConfig.url}/${content.slug}` },
        ],
      },
    ],
  };
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="border-b border-line bg-surface">
        <Container className="max-w-4xl py-20">
          <nav aria-label="Fil d'Ariane" className="text-sm text-muted-fg">
            <Link href="/" className="hover:text-ink">
              Accueil
            </Link>{" "}
            / <span aria-current="page">{content.eyebrow}</span>
          </nav>
          <h1 className="mt-6 text-balance font-display text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl">{content.h1}</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-fg">{content.intro}</p>
          <Button asChild size="lg" className="mt-8">
            <Link href={content.cta.href}>
              {content.cta.label} <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </Container>
      </header>
      <Container className="flex max-w-4xl flex-col gap-14 py-20">
        {content.blocks.map((b) => (
          <section key={b.title} className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">{b.title}</h2>
            {b.body.map((p) => (
              <p key={p} className="leading-relaxed text-ink-soft">
                {p}
              </p>
            ))}
            {b.list ? (
              <ul className="list-disc space-y-2 pl-6 text-ink-soft">
                {b.list.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-2xl font-bold tracking-tight">En pratique</h2>
          <ol className="flex flex-col gap-3">
            {content.steps.map((s, i) => (
              <li key={s} className="flex gap-4 rounded-xl border border-line p-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight">Questions fréquentes</h2>
          <Accordion type="single" collapsible className="rounded-2xl border border-line px-6">
            {content.faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`q-${i}`} question={f.q}>
                {f.a}
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </Container>
    </article>
  );
}
