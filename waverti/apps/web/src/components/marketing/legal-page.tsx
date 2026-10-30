import { Callout, Container } from "@waverti/ui";

/** Les mentions entre crochets [À COMPLÉTER …] doivent être renseignées puis validées par un juriste. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <Container className="max-w-3xl py-20">
      <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted-fg">Version du modèle : {updated}</p>
      <Callout tone="warning" title="Document modèle à compléter et à faire valider" className="mt-8">
        Ce texte est un modèle préparé pour le lancement de Waverti. Les informations entre crochets doivent être complétées
        par LULLIN WEB et l'ensemble du document validé par un professionnel du droit avant toute commercialisation.
      </Callout>
      <div className="legal mt-10 flex flex-col gap-4 leading-relaxed text-ink-soft [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-6 [&_li]:list-disc [&_mark]:rounded [&_mark]:bg-warning-soft [&_mark]:px-1 [&_mark]:text-ink">
        {children}
      </div>
    </Container>
  );
}

export function Todo({ children }: { children: React.ReactNode }) {
  return <mark>[À COMPLÉTER : {children}]</mark>;
}
