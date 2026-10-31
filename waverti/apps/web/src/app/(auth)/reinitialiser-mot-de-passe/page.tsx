import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@waverti/ui";
import { AuthCard } from "../auth-card";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };

/** Lien reçu par e-mail : le jeton n'est vérifié (et consommé) qu'à l'envoi du nouveau mot de passe. */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return (
      <AuthCard title="Lien invalide">
        <div className="flex flex-col gap-4">
          <Callout tone="warning">Ce lien de réinitialisation n'est pas valide. Demandez-en un nouveau.</Callout>
          <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-blue underline-offset-4 hover:underline">
            Recevoir un nouveau lien
          </Link>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choisissez un nouveau mot de passe" description="Toutes vos sessions ouvertes seront déconnectées par sécurité.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
