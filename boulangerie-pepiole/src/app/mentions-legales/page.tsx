import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales & confidentialité",
  description: `Informations légales et politique de confidentialité du site ${SITE.name}.`,
  alternates: { canonical: "/mentions-legales" },
};

function Block({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-mie py-10">
      <h2 className="mb-4 font-display text-3xl tracking-tight">{title}</h2>
      <div className="space-y-3 leading-relaxed text-cafe/80">{children}</div>
    </section>
  );
}

export default function MentionsLegales() {
  const L = SITE.legal;
  return (
    <article className="bg-farine px-6 pb-32 pt-36">
      <div className="mx-auto max-w-3xl">
        <p className="font-script text-3xl text-caramel">Les petites lignes</p>
        <h1 className="mb-10 font-display text-5xl tracking-tight sm:text-6xl">Mentions légales</h1>

        <Block title="Éditeur du site">
          <p>
            <strong>{L.company}</strong>, exploitant l&apos;enseigne « {L.tradeName} »
            <br />
            {L.form}
            <br />
            Siège social : {L.headOffice}
            <br />
            SIREN : {L.siren} · SIRET : {L.siret}
            <br />
            {L.rcs}
            <br />
            N° TVA intracommunautaire : {L.vat}
            <br />
            Code NAF : {L.naf}
            <br />
            Téléphone : <a href={SITE.phone.href} className="underline">{SITE.phone.display}</a>
          </p>
          <p>Directeur de la publication : {L.publicationDirector}.</p>
        </Block>

        <Block title="Hébergement">
          <p>
            {L.host.name}, {L.host.address} —{" "}
            <a href={L.host.url} className="underline" target="_blank" rel="noopener noreferrer">
              vercel.com
            </a>
          </p>
        </Block>

        <Block title="Propriété intellectuelle">
          <p>
            Les textes, le logo et la mise en page de ce site sont la propriété de {L.company}. Toute reproduction sans
            autorisation est interdite. Les photographies d&apos;illustration proviennent de la banque d&apos;images Unsplash
            (licence Unsplash) et ne représentent pas nécessairement les produits vendus en boutique.
          </p>
        </Block>

        <Block id="donnees" title="Données personnelles & commandes en ligne">
          <p>
            Lorsque vous passez une commande, nous collectons votre nom, votre téléphone et, si vous le souhaitez, votre
            adresse e-mail. Ces données servent <strong>uniquement</strong> à préparer votre commande et à vous contacter à
            son sujet (base légale : exécution de la commande). Elles ne sont ni vendues ni utilisées à des fins
            publicitaires.
          </p>
          <p>
            Elles sont conservées le temps nécessaire au traitement de la commande, puis au maximum 3 ans pour le suivi de la
            relation client, sauf obligation légale contraire. Elles peuvent transiter par nos prestataires techniques
            (hébergement Vercel, envoi d&apos;e-mails), liés par des obligations de confidentialité.
          </p>
          <p>
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement,
            d&apos;opposition et de limitation. Pour l&apos;exercer, contactez la boutique au {SITE.phone.display} ou par
            courrier à l&apos;adresse du siège. Vous pouvez également introduire une réclamation auprès de la CNIL
            (cnil.fr).
          </p>
        </Block>

        <Block title="Cookies & stockage local">
          <p>
            Ce site n&apos;utilise ni cookie publicitaire ni outil de mesure d&apos;audience. Votre panier est enregistré
            uniquement dans votre navigateur (stockage local) pour ne pas le perdre entre deux pages. La carte
            d&apos;accès est fournie par Google Maps, qui peut déposer ses propres cookies lorsque vous l&apos;utilisez.
          </p>
        </Block>

        <Block title="Commandes & retrait">
          <p>
            Les commandes passées en ligne sont à retirer en boutique au créneau choisi et se règlent sur place. Les prix
            affichés sont en euros TTC. Les photos sont non contractuelles. Informations sur les allergènes disponibles en
            boutique sur simple demande.
          </p>
        </Block>
      </div>
    </article>
  );
}
