import InfoPageLayout from '@/components/InfoPageLayout';

export default function RulesPage() {
  return (
    <InfoPageLayout title="Règles de la communauté MILOU">
      <section>
        <h2 className="text-xl font-semibold text-white">Respect et sécurité</h2>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Pas d&apos;insultes, harcèlement ou contenu illégal.</li>
          <li>Les échanges se font via les missions et l&apos;escrow MILOU — évitez les paiements hors plateforme.</li>
          <li>Signalez toute annonce suspecte via le bouton « Signaler ».</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">Annonces</h2>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Description honnête, prix en Milou (M) clair, délai réaliste.</li>
          <li>Les annonces ouvertes non pourvues expirent après 30 jours.</li>
          <li>Les brouillons ne sont visibles que par vous jusqu&apos;à publication.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">Missions et avis</h2>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Le client valide la mission une fois le travail livré ; les M sont alors libérés.</li>
          <li>Les avis après mission sont obligatoires pour maintenir la confiance.</li>
          <li>En cas de litige, utilisez le formulaire « Ne pas valider » — un modérateur tranchera.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">Sanctions</h2>
        <p>
          MILOU peut suspendre un compte, retirer une annonce ou résoudre un litige en faveur du client ou du
          prestataire selon les preuves (chat, délais, signalements).
        </p>
      </section>
    </InfoPageLayout>
  );
}
