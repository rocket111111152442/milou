import { PageHead } from "./PageHead";

/** Pages légales : texte libre (paragraphes séparés par une ligne vide), mis en page comme des articles. */
export function LegalPage({ title, text }: { title: string; text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      <PageHead kicker="Informations" folio="légales" title={title} />
      <section className="wrap pb-28">
        <div className="max-w-3xl space-y-6 border-t border-ink/15 pt-10 lg:ml-[8.33%]">
          {blocks.map((b, i) => {
            const m = b.match(/^(\d+)\.\s*([^—–-]+?)\s*[—–-]\s*([\s\S]*)$/);
            return m ? (
              <article key={i} className="grid gap-2 sm:grid-cols-[3rem_1fr]">
                <span className="font-text text-[0.95rem] italic text-ink-muted">{m[1]}.</span>
                <div>
                  <h2 className="font-display text-[1.45rem] leading-tight">{m[2]}</h2>
                  <p className="body-text mt-2 whitespace-pre-line">{m[3]}</p>
                </div>
              </article>
            ) : (
              <p key={i} className="body-text whitespace-pre-line">
                {b}
              </p>
            );
          })}
        </div>
      </section>
    </>
  );
}
