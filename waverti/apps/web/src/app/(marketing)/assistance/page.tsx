import type { Metadata } from "next";
import { Container } from "@waverti/ui";
import { SupportForm } from "./support-form";

export const metadata: Metadata = {
  title: "Assistance",
  description: "Contactez l'équipe Waverti : compte, abonnement, surveillances, application desktop, Business, confidentialité.",
  alternates: { canonical: "/assistance" },
};

export default function AssistancePage() {
  return (
    <Container className="grid max-w-5xl gap-12 py-20 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight">Assistance</h1>
        <p className="leading-relaxed text-muted-fg">
          Décrivez votre question ou votre problème. Votre demande est enregistrée et traitée par l'équipe Waverti ; vous recevez
          un e-mail de confirmation lorsque l'envoi d'e-mails est configuré.
        </p>
        <p className="text-sm text-muted-fg">
          Pour une demande relative à vos données personnelles (accès, rectification, suppression), choisissez la catégorie
          « Confidentialité ». Vous pouvez aussi exporter vos données ou supprimer votre compte directement depuis vos paramètres.
        </p>
      </div>
      <SupportForm />
    </Container>
  );
}
