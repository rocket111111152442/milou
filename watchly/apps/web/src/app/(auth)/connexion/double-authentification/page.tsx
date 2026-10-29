import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/request";
import { AuthCard } from "../../auth-card";
import { MfaChallengeForm } from "../../auth-forms";

export const metadata: Metadata = { title: "Double authentification", robots: { index: false } };

export default async function MfaChallengePage({ searchParams }: { searchParams: Promise<{ suivant?: string }> }) {
  const next = safeNext((await searchParams).suivant, "/app");
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suivant=${encodeURIComponent(next)}`);
  if (!user.mfa.enrolled || user.mfa.verified) redirect(next);
  return (
    <AuthCard
      title="Double authentification"
      description="Votre compte est protégé par un code temporaire. Saisissez le code affiché par votre application d'authentification."
      footer={
        <form action="/auth/deconnexion" method="post">
          <button type="submit" className="font-medium text-blue underline-offset-4 hover:underline">
            Annuler et se déconnecter
          </button>
        </form>
      }
    >
      <MfaChallengeForm suivant={next} />
    </AuthCard>
  );
}
