import type { Metadata } from "next";
import { PageHero, SectionTitle, CTABand } from "@/components/ui";
import { ActivityExplorer } from "@/components/ActivityExplorer";
import { getActivities } from "@/lib/store";
import { todayISO } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Événements & stages vacances pour enfants à La Seyne-sur-Mer",
  description:
    "Stages ludiques pendant les vacances scolaires, Chouet'Foraine, bourse aux jouets, mini retraite enchantée, soirées à thème : tous les événements famille de Chouet'House à La Seyne-sur-Mer.",
  alternates: { canonical: "/evenements" },
};

export default async function EvenementsPage() {
  const all = await getActivities();
  const events = all.filter((a) => a.kind !== "atelier");
  const today = todayISO();

  return (
    <>
      <PageHero
        eyebrow="Événements · Stages vacances"
        title="Des temps forts à partager en famille"
        intro={
          <p>
            Stages ludiques pendant les vacances scolaires, fête foraine des petits, bourse aux jouets, rendez-vous de saison… Chez Chouet&apos;House, il se passe
            toujours quelque chose !
          </p>
        }
        image="/images/ateliers/chouet-foraine.webp"
        imageAlt="Illustration fête foraine Chouet'Foraine"
        color="butter"
      >
        <a href="#planning" className="btn-primary">Prochaines dates</a>
      </PageHero>

      <ActivityExplorer activities={events} today={today} catalogEyebrow="Stages & événements" catalogTitle="Nos rendez-vous" />

      <section className="container-x mt-24">
        <SectionTitle
          eyebrow="Ne ratez rien"
          title="Suivez nos actus"
          intro={
            <p>
              Les nouveaux événements sont annoncés sur notre <a className="font-bold text-tomato underline" href="/blog">blog</a> et sur Instagram{" "}
              <a className="font-bold text-tomato underline" href="https://www.instagram.com/chouethouse/" target="_blank" rel="noopener">@chouethouse</a>.
            </p>
          }
        />
      </section>

      <CTABand title="Une idée d'événement ?" text="Une question sur nos événements ou une idée à nous proposer ? Écrivez-nous !">
        <a href="/contact" className="btn-yellow">Nous écrire</a>
      </CTABand>
    </>
  );
}
