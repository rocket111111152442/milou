import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales & accessibilité",
  description: "Mentions légales, conditions générales et déclaration d'accessibilité du site Chouet'House.",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsPage() {
  return (
    <>
      <PageHero eyebrow="Informations légales" title="Mentions légales" intro={<p>Informations relatives à l&apos;éditeur du site, à son hébergement et aux conditions d&apos;utilisation.</p>} color="sage" />
      <div className="container-x prose-ch max-w-3xl">
        <h2>Éditeur du site</h2>
        <p>
          <strong>{SITE.fullName}</strong>
          <br />
          {SITE.street}, {SITE.postalCode} {SITE.city}
          <br />
          Téléphone : {SITE.phone} – E-mail : {SITE.email}
          <br />
          Forme juridique, capital et SIRET : <em>[à compléter]</em>
          <br />
          Directeur·rice de la publication : <em>[à compléter]</em>
        </p>
        <h2>Conception</h2>
        <p>
          Site conçu et réalisé par <a href="https://lullin-web.com" target="_blank" rel="noopener">lullin-web.com</a>.
        </p>
        <h2>Hébergement</h2>
        <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis – vercel.com</p>
        <h2>Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des contenus de ce site (textes, logos, photographies, illustrations) est la propriété de Chouet&apos;House ou de ses partenaires. Toute reproduction sans
          autorisation est interdite.
        </p>
        <h2>Réservations et ateliers</h2>
        <p>
          Les demandes effectuées via le site (table, ateliers, anniversaires) sont des demandes de réservation : elles ne sont définitives qu&apos;après confirmation par
          Chouet&apos;House. Pour toute annulation, merci de nous prévenir le plus tôt possible par téléphone ou par e-mail.
        </p>
        <h2>Déclaration d&apos;accessibilité</h2>
        <p>
          Nous nous efforçons de rendre ce site accessible au plus grand nombre : navigation au clavier, contrastes renforcés, textes alternatifs sur les images et respect
          de la préférence « réduire les animations » de votre appareil. Si vous rencontrez une difficulté, contactez-nous au {SITE.phone} ou à {SITE.email}.
        </p>
        <p>Le lieu Chouet&apos;House est accessible aux personnes à mobilité réduite.</p>
      </div>
    </>
  );
}
