import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { ForgotPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez votre adresse pour recevoir, si un compte existe, un lien de réinitialisation du mot de passe. Il est valable 1 heure ; une nouvelle demande remplace les liens précédents."
      footer={
        <Link href="/connexion" className="font-medium text-blue underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
