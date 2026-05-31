import InfoPageLayout from '@/components/InfoPageLayout';

export default function FaqPage() {
  return (
    <InfoPageLayout title="FAQ">
      <details className="card p-4">
        <summary className="font-medium text-white cursor-pointer">Qu&apos;est-ce qu&apos;un Milou (M) ?</summary>
        <p className="mt-2 text-zinc-400">
          Unité interne pour payer des services entre membres. Pas une cryptomonnaie : crédité à l&apos;inscription,
          par codes promo ou après missions validées.
        </p>
      </details>
      <details className="card p-4">
        <summary className="font-medium text-white cursor-pointer">Pourquoi un code postal ?</summary>
        <p className="mt-2 text-zinc-400">
          Pour filtrer les annonces « près de chez moi » et les services en présentiel dans votre zone.
        </p>
      </details>
      <details className="card p-4">
        <summary className="font-medium text-white cursor-pointer">Que se passe-t-il si le délai est dépassé ?</summary>
        <p className="mt-2 text-zinc-400">
          MILOU peut clôturer automatiquement la mission selon les règles d&apos;escrow (remboursement client ou
          pénalité prestataire selon le cas).
        </p>
      </details>
      <details className="card p-4">
        <summary className="font-medium text-white cursor-pointer">Les avis sont-ils obligatoires ?</summary>
        <p className="mt-2 text-zinc-400">
          Oui, après chaque mission terminée (sauf clôture automatique pour délai). Vous ne pourrez pas ignorer
          indéfiniment : un rappel s&apos;affiche jusqu&apos;à envoi.
        </p>
      </details>
      <details className="card p-4">
        <summary className="font-medium text-white cursor-pointer">Comment signaler une annonce ?</summary>
        <p className="mt-2 text-zinc-400">
          Sur chaque carte du marketplace, utilisez « Signaler ». L&apos;équipe modération examine les rapports.
        </p>
      </details>
    </InfoPageLayout>
  );
}
