import { PageHero } from "./PageHero";

export function LegalPage({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <>
      <PageHero eyebrow="Informations légales" title={title} crumbs={[{ href, label: title }]} compact />
      <section className="fern-paper bg-ivory py-24 text-noir">
        <article className="mx-auto max-w-3xl space-y-5 px-6 text-[1.05rem] leading-relaxed text-noir/75">
          {text.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </article>
      </section>
    </>
  );
}
