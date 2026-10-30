import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Compte suspendu", robots: { index: false } };

export default function SuspendedPage() {
  return (
    <AuthCard title="Compte suspendu" description="L'accès à ce compte a été suspendu suite à une utilisation contraire aux conditions générales.">
      <p className="text-sm leading-relaxed text-ink-soft">
        Si vous pensez qu'il s'agit d'une erreur, contactez-nous depuis la page{" "}
        <Link href="/assistance" className="text-blue underline">
          Assistance
        </Link>
        . Vos données ne sont pas supprimées pendant la suspension.
      </p>
    </AuthCard>
  );
}
