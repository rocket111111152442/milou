import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthCard } from "../auth-card";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default async function ResetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?erreur=lien");
  return (
    <AuthCard title="Choisissez un nouveau mot de passe" description="Vos autres sessions seront déconnectées par sécurité.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
