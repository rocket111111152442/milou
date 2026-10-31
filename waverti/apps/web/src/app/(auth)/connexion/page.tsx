import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@waverti/ui";
import { AuthCard } from "../auth-card";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

const ERRORS: Record<string, string> = {
  lien: "Ce lien n'est plus valide ou a déjà été utilisé. Reconnectez-vous ou demandez un nouveau lien.",
  configuration: "L'authentification n'est pas encore configurée sur cet environnement.",
  session: "Votre session a expiré, reconnectez-vous.",
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ suivant?: string; erreur?: string; verifie?: string }> }) {
  const { suivant, erreur, verifie } = await searchParams;
  return (
    <AuthCard
      title="Connexion"
      description="Accédez à vos surveillances et à vos alertes."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-medium text-blue underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {erreur && ERRORS[erreur] ? <Callout tone="warning">{ERRORS[erreur]}</Callout> : null}
        {verifie ? <Callout tone="success">Adresse e-mail vérifiée. Vous pouvez vous connecter.</Callout> : null}
        <SignInForm suivant={suivant} />
      </div>
    </AuthCard>
  );
}
