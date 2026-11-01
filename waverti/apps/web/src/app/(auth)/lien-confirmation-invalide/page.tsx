import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { ResendConfirmationByEmailForm } from "../auth-forms";

export const metadata: Metadata = { title: "Lien de confirmation invalide", robots: { index: false } };

/**
 * Affichée quand un lien « Confirmer mon adresse » est expiré (24 h), déjà utilisé ou remplacé par un message plus récent.
 * Simple page d'information : aucun jeton n'est créé ni consommé en l'affichant.
 */
export default function InvalidConfirmationLinkPage() {
  return (
    <AuthCard title="Ce lien de confirmation n'est plus valable">
      <div className="flex flex-col gap-6">
        <p className="leading-relaxed text-ink-soft">
          Ce lien servait à <strong>confirmer votre adresse e-mail</strong>. Il est valable 24 heures, ne peut servir qu'une fois et
          est remplacé par chaque nouveau message de confirmation.
        </p>
        <section aria-labelledby="already" className="flex flex-col gap-2">
          <h2 id="already" className="font-display text-base font-semibold">
            Votre adresse est peut-être déjà confirmée
          </h2>
          <p className="text-sm text-ink-soft">Dans ce cas, il suffit de vous connecter.</p>
          <Link href="/connexion" className="text-sm font-medium text-blue underline-offset-4 hover:underline">
            Aller à la connexion
          </Link>
        </section>
        <section aria-labelledby="resend" className="flex flex-col gap-2">
          <h2 id="resend" className="font-display text-base font-semibold">
            Sinon, demandez un nouveau lien
          </h2>
          <ResendConfirmationByEmailForm />
        </section>
        <section aria-labelledby="forgot" className="flex flex-col gap-2 border-t border-line pt-4">
          <h2 id="forgot" className="font-display text-base font-semibold">
            Vous cherchez à changer de mot de passe ?
          </h2>
          <p className="text-sm text-ink-soft">Ce n'est pas le même message : la réinitialisation se demande séparément.</p>
          <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-blue underline-offset-4 hover:underline">
            Mot de passe oublié
          </Link>
        </section>
      </div>
    </AuthCard>
  );
}
