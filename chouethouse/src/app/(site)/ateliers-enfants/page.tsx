import type { Metadata } from "next";
import { PageHero, SectionTitle, CTABand } from "@/components/ui";
import { ActivityExplorer } from "@/components/ActivityExplorer";
import { Stagger, StaggerItem } from "@/components/motion";
import { getActivities } from "@/lib/store";
import { parisOffset, todayISO } from "@/lib/format";
import { SITE } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Ateliers parents-enfants & éveil bébé à La Seyne-sur-Mer",
  description:
    "Planning des ateliers Chouet'House : éveil sensoriel, anglais dès 6 mois avec Lauren, danse parents-enfants, éveil musical, pâtisserie, massage bébé, stages vacances. De 0 à 11 ans, à La Seyne-sur-Mer près de Toulon.",
  alternates: { canonical: "/ateliers-enfants" },
};

export default async function AteliersPage() {
  const activities = (await getActivities()).filter((a) => a.kind !== "evenement");
  const today = todayISO();

  const eventsLd = activities.flatMap((a) =>
    a.sessions
      .filter((s) => s.date >= today)
      .map((s) => ({
        "@context": "https://schema.org",
        "@type": "Event",
        name: `${a.title} (${a.ageLabel})`,
        description: a.description,
        startDate: `${s.date}T${s.start}:00${parisOffset(s.date)}`,
        endDate: `${s.date}T${s.end}:00${parisOffset(s.date)}`,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        image: `${SITE.url}${a.image}`,
        location: {
          "@type": "Place",
          name: SITE.fullName,
          address: { "@type": "PostalAddress", streetAddress: "2496 Avenue Pierre Auguste Renoir", postalCode: "83500", addressLocality: "La Seyne-sur-Mer", addressCountry: "FR" },
        },
        organizer: { "@type": "Organization", name: SITE.fullName, url: SITE.url },
        offers: { "@type": "Offer", price: a.price, priceCurrency: "EUR", availability: "https://schema.org/InStock", url: `${SITE.url}/ateliers-enfants` },
      }))
  );

  return (
    <>
      {eventsLd.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventsLd) }} />}
      <PageHero
        eyebrow="Ateliers · 0 à 11 ans"
        title="Des ateliers pour grandir ensemble"
        intro={
          <p>
            Éveil sensoriel, anglais, danse, musique, pâtisserie, bien-être… À Chouet&apos;House, les ateliers se vivent souvent <strong className="text-ink">en duo parent-enfant</strong>,
            dans un cadre doux et bienveillant. Des moments de découverte et de complicité, dès les premiers mois.
          </p>
        }
        image="/images/ateliers/cinq-sens.webp"
        imageAlt="Illustration d'un bébé en atelier d'éveil sensoriel"
        color="sage"
      >
        <a href="#planning" className="btn-primary">Voir le planning</a>
        <a href="#catalogue" className="btn-ghost">Tous les ateliers</a>
      </PageHero>

      <section className="container-x pb-20">
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { e: "👶", t: "Dès 0 an", d: "Massage bébé, réflexologie, bébés signes" },
            { e: "🇬🇧", t: "Anglais", d: "Avec Lauren, native d'Angleterre" },
            { e: "👨‍👩‍👧", t: "En duo", d: "La plupart des ateliers se vivent parent-enfant" },
            { e: "☀️", t: "Vacances", d: "Stages ludiques pendant les vacances scolaires" },
          ].map((x) => (
            <StaggerItem key={x.t}>
              <div className="flex items-center gap-4 rounded-3xl bg-white p-5 ring-1 ring-ink/5">
                <span className="text-4xl">{x.e}</span>
                <div>
                  <p className="font-display text-xl font-semibold">{x.t}</p>
                  <p className="text-sm text-ink-soft">{x.d}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <ActivityExplorer activities={activities} today={today} />

      <section className="container-x mt-28">
        <SectionTitle
          eyebrow="Comment ça marche ?"
          title="Réserver en 3 étapes"
        />
        <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { n: "1", t: "Choisissez", d: "Un atelier et une séance dans le planning ci-dessus.", c: "bg-mustard" },
            { n: "2", t: "Réservez", d: "Remplissez le petit formulaire : 1 minute chrono.", c: "bg-coral" },
            { n: "3", t: "Profitez", d: "Nous vous confirmons la place. Il ne reste qu'à venir vous amuser !", c: "bg-sage" },
          ].map((s) => (
            <StaggerItem key={s.n}>
              <div className="card relative h-full p-8 pt-12">
                <span className={`absolute -top-7 left-8 grid h-14 w-14 place-items-center rounded-2xl ${s.c} font-display text-3xl font-bold`}>{s.n}</span>
                <h3 className="text-2xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-ink-soft">{s.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <CTABand title="Vous animez un atelier ?" text="Intervenant(e) en éveil, bien-être, parentalité ou loisirs créatifs ? Proposez-nous votre atelier !">
        <a href="/contact" className="btn-yellow">Nous contacter</a>
      </CTABand>
    </>
  );
}
