import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { AuthCard } from "../auth-card";
import { ResendConfirmationForm } from "../auth-forms";

export const metadata: Metadata = { title: "Vérifiez votre e-mail", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthCard title="Vérifiez votre adresse e-mail">
      <div className="flex flex-col gap-5">
        <span className="grid size-12 place-items-center rounded-2xl bg-surface">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <p className="leading-relaxed text-ink-soft">
          Un lien de confirmation a été envoyé{email ? <> à <strong>{email}</strong></> : null}. Cliquez dessus pour activer votre
          compte. Pensez à vérifier vos courriers indésirables.
        </p>
        {email ? <ResendConfirmationForm email={email} /> : null}
      </div>
    </AuthCard>
  );
}
