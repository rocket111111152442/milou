"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Callout } from "@waverti/ui";

const MAX_REFRESH = 8;
const EVERY_MS = 3000;

/**
 * Confirmation en cours : la page serveur est rechargée de façon BORNÉE (8 fois, toutes les 3 s). Passé ce délai,
 * on propose une vérification manuelle ou l'assistance — jamais de seconde souscription.
 */
export function ConfirmingCallout() {
  const router = useRouter();
  const [tries, setTries] = React.useState(0);
  React.useEffect(() => {
    if (tries >= MAX_REFRESH) return;
    const id = window.setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, EVERY_MS);
    return () => window.clearTimeout(id);
  }, [tries, router]);

  if (tries < MAX_REFRESH) {
    return (
      <Callout tone="info" title="Confirmation de votre abonnement en cours" role="status">
        Stripe nous confirme votre paiement : cela prend en général quelques secondes. Ne souscrivez pas une seconde fois, cette page se met à jour toute seule.
      </Callout>
    );
  }
  return (
    <Callout tone="warning" title="La confirmation prend plus de temps que prévu" role="status">
      <p>
        Votre retour de paiement a bien été reçu, mais l'abonnement n'est pas encore enregistré. Ne souscrivez pas une seconde fois.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setTries(0);
            router.refresh();
          }}
        >
          Vérifier à nouveau
        </Button>
        <Button asChild variant="ghost">
          <Link href="/assistance">Contacter l'assistance</Link>
        </Button>
      </div>
    </Callout>
  );
}
