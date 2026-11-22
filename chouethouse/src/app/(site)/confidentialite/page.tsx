import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment Chouet'House collecte et protège les données personnelles transmises via le site.",
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  return (
    <>
      <PageHero eyebrow="RGPD" title="Politique de confidentialité" intro={<p>Vos données sont précieuses : voici comment nous les utilisons.</p>} color="peach" />
      <div className="container-x prose-ch max-w-3xl">
        <h2>Données collectées</h2>
        <p>
          Lorsque vous remplissez un formulaire (réservation de table, atelier, anniversaire, contact), nous recueillons les informations que vous saisissez : nom,
          téléphone, e-mail, date souhaitée, nombre de participants et votre message.
        </p>
        <h2>Finalité</h2>
        <p>Ces données servent uniquement à traiter votre demande et à vous recontacter. Elles ne sont ni revendues, ni utilisées à des fins publicitaires.</p>
        <h2>Durée de conservation</h2>
        <p>Les demandes sont conservées le temps nécessaire à leur traitement, et au maximum 3 ans après le dernier contact.</p>
        <h2>Stockage</h2>
        <p>Les données sont stockées de manière privée chez notre hébergeur (Vercel) et accessibles uniquement à l&apos;équipe Chouet&apos;House.</p>
        <h2>Cookies</h2>
        <p>Ce site n&apos;utilise pas de cookies publicitaires ni de traceurs. La carte Google Maps intégrée peut déposer ses propres cookies lorsque vous l&apos;utilisez.</p>
        <h2>Vos droits</h2>
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification et de suppression de vos données. Pour l&apos;exercer, écrivez-nous à{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. Vous pouvez également introduire une réclamation auprès de la CNIL (cnil.fr).
        </p>
      </div>
    </>
  );
}
