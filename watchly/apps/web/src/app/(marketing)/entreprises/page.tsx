import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileCode2, Globe2, Timer } from "lucide-react";
import { Button, Container, SectionHeading } from "@watchly/ui";
import { BusinessSection, FinalCta } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Watchly Business — surveillance de sites pour entreprises",
  description:
    "Disponibilité vérifiée chaque minute, pannes confirmées avant alerte, tests de parcours, certificat HTTPS et rapports d'incidents pour votre site professionnel.",
  alternates: { canonical: "/entreprises" },
};

const onboarding = [
  { icon: <Globe2 />, title: "Ajoutez votre site", text: "Indiquez son nom de domaine. Un jeton de vérification unique est généré." },
  {
    icon: <BadgeCheck />,
    title: "Prouvez que vous en êtes responsable",
    text: "Ajoutez un enregistrement DNS TXT ou publiez un fichier de vérification. Sans preuve, aucun contrôle intensif n'est lancé.",
  },
  { icon: <Timer />, title: "Choisissez vos points de contrôle", text: "Jusqu'à 3 adresses vérifiées chaque minute, avec code HTTP et mot-clé attendus." },
  {
    icon: <FileCode2 />,
    title: "Décrivez un parcours",
    text: "Un scénario navigateur (navigation, saisie, vérifications) rejoué toutes les 2 heures, sans achat ni envoi vers un tiers.",
  },
];

export default function EntreprisesPage() {
  return (
    <>
      <BusinessSection standalone />
      <section aria-labelledby="onboarding-title" className="py-24">
        <Container>
          <SectionHeading
            id="onboarding-title"
            eyebrow="Mise en route"
            title="Opérationnel en quelques minutes"
            description="Watchly Business ne contrôle que les sites dont vous prouvez la propriété ou l'autorisation."
          />
          <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {onboarding.map((o, i) => (
              <li key={o.title} className="rounded-2xl border border-line bg-white p-6">
                <span className="text-sm font-bold text-muted-fg">0{i + 1}</span>
                <span className="mt-4 grid size-11 place-items-center rounded-2xl bg-surface [&_svg]:size-5">{o.icon}</span>
                <h3 className="mt-5 font-display text-lg font-semibold">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-fg">{o.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex justify-center">
            <Button asChild size="lg">
              <Link href="/inscription?formule=business">Essayer Business pendant 72 h</Link>
            </Button>
          </div>
        </Container>
      </section>
      <FinalCta />
    </>
  );
}
