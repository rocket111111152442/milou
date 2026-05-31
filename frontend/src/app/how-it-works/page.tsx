import InfoPageLayout from '@/components/InfoPageLayout';

export default function HowItWorksPage() {
  return (
    <InfoPageLayout title="Comment ça marche">
      <section>
        <h2 className="text-xl font-semibold text-white">1. Créer un compte</h2>
        <p>
          Inscription gratuite avec code postal. Vous recevez des Milou (M) de bienvenue pour commencer à
          échanger sur le marketplace.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">2. Publier ou répondre</h2>
        <p>
          Offrez un service (offre) ou demandez de l&apos;aide (demande). Ajoutez photos, catégorie, délai et
          filtrez par proximité (même code postal).
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">3. Mission en escrow</h2>
        <p>
          Quand quelqu&apos;un accepte, une mission démarre : les M sont bloqués, un chat s&apos;ouvre, des étapes
          guident la progression (travail → livraison → validation client).
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">4. Validation et avis</h2>
        <p>
          Le client valide → paiement au prestataire. Chacun laisse un avis obligatoire. Votre score de fiabilité
          et vos badges évoluent avec votre activité.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">5. Transparence</h2>
        <p>
          Consultez l&apos;historique Milou, le profil public des membres et les règles détaillées dans l&apos;app.
          Premium MILOU offre mise en avant et limites étendues.
        </p>
      </section>
    </InfoPageLayout>
  );
}
