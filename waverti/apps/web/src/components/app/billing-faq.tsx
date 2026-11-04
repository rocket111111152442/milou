import { ChevronDown } from "lucide-react";

/** Réponses alignées sur le fonctionnement réel de la facturation (Stripe, essai, résiliation, changement de formule). */
const ITEMS: Array<{ q: string; a: string }> = [
  { q: "Existe-t-il une formule gratuite ?", a: "Non. Il n'y a pas de formule gratuite permanente. Quand l'essai est possible pour votre compte, il dure 3 jours et s'applique aux formules payantes." },
  { q: "Que se passe-t-il à la fin de l'essai ?", a: "Le premier prélèvement a lieu à la fin de l'essai, sauf si vous résiliez avant. La résiliation se fait en ligne depuis la page Abonnement, sans formulaire ni appel." },
  { q: "Mes surveillances fonctionnent-elles ordinateur éteint ?", a: "Oui. Les vérifications sont faites par les serveurs Waverti, même quand votre ordinateur est éteint." },
  { q: "Puis-je changer de formule plus tard ?", a: "Oui. Le changement est proratisé par Stripe : la différence est créditée ou facturée sur la prochaine facture. En cas de baisse de quotas, les surveillances excédentaires sont mises en pause, jamais supprimées." },
  { q: "Qui traite le paiement ?", a: "Stripe. Vous êtes redirigé vers sa page de paiement sécurisée ; Waverti ne voit pas votre numéro de carte. Vos factures et votre moyen de paiement se gèrent depuis le portail de facturation." },
  { q: "Désinstaller l'application résilie-t-il l'abonnement ?", a: "Non. Désinstaller l'application ou supprimer vos surveillances ne résilie pas l'abonnement : utilisez le bouton « Résilier » de la page Abonnement." },
];

export function BillingFaq() {
  return (
    <section aria-labelledby="faq-title" className="flex flex-col gap-4">
      <h2 id="faq-title" className="font-display text-lg font-semibold">
        Questions fréquentes
      </h2>
      <div className="card-glass divide-y divide-line/70 overflow-hidden rounded-2xl shadow-[var(--shadow-card)]">
        {ITEMS.map((it) => (
          <details key={it.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium focus-visible:outline-2 focus-visible:outline-blue [&::-webkit-details-marker]:hidden">
              {it.q}
              <ChevronDown className="size-4 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
