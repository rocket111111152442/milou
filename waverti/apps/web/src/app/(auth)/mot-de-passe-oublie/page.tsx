import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { ForgotPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez votre adresse : vous recevrez un lien pour choisir un nouveau mot de passe."
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
