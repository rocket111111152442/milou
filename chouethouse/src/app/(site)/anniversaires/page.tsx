import type { Metadata } from "next";
import { PageHero, SectionTitle } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import Image from "next/image";
import { Blob, Star, Wave } from "@/components/decor";
import { RequestForm } from "@/components/RequestForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Anniversaire enfant à La Seyne-sur-Mer – formules sur mesure",
  description:
    "Fêtez l'anniversaire de votre enfant chez Chouet'House à La Seyne-sur-Mer : un lieu familial, coloré et gourmand près de Toulon. Demandez votre formule en précisant l'âge de l'enfant.",
  alternates: { canonical: "/anniversaires" },
};

export default function AnniversairesPage() {
  return (
    <>
      <PageHero
        eyebrow="Anniversaires"
        title="Un anniversaire chouette et inoubliable"
        intro={
          <p>
            Vous cherchez un lieu pour fêter l&apos;anniversaire de votre enfant à La Seyne-sur-Mer ? Chouet&apos;House vous ouvre son cocon coloré et gourmand pour un moment
            magique… et <strong className="text-ink">sans stress pour les parents</strong>.
          </p>
        }
        image="/images/anniversaire-enfants.webp"
        imageAlt="Enfants qui soufflent les bougies d'un gâteau d'anniversaire"
        color="peach"
      >
        <a href="#demande" className="btn-primary">Demander une formule</a>
        <a href={`tel:${SITE.phoneHref}`} className="btn-ghost">📞 {SITE.phone}</a>
      </PageHero>

      <section className="container-x py-16">
        <SectionTitle eyebrow="Pourquoi chez nous ?" title="Tout est pensé pour la fête" />
        <Stagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { e: "🎈", t: "Un lieu adapté", d: "Un espace familial, chaleureux et pensé pour accueillir les enfants.", c: "bg-butter" },
            { e: "🎂", t: "La gourmandise", d: "Fait maison et préparé avec amour : le goûter, c'est notre spécialité !", c: "bg-shell" },
            { e: "🎨", t: "Des activités", d: "Notre savoir-faire en ateliers créatifs au service de la fête.", c: "bg-mint" },
            { e: "🧸", t: "Selon l'âge", d: "Une formule adaptée à l'âge de votre enfant et à vos envies.", c: "bg-peach" },
          ].map((x, i) => (
            <StaggerItem key={x.t}>
              <div className={`${x.c} group h-full rounded-[2rem] p-7 transition duration-500 hover:-translate-y-2 ${i % 2 ? "hover:rotate-2" : "hover:-rotate-2"}`}>
                <span className="inline-block text-5xl transition duration-500 group-hover:scale-125">{x.e}</span>
                <h3 className="mt-4 text-2xl font-semibold">{x.t}</h3>
                <p className="mt-2 text-ink-soft">{x.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="container-x py-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-[3rem] bg-ink p-8 text-white sm:p-14">
            <Blob className="-top-16 -right-16 h-72 w-72 opacity-30" color="var(--color-coral)" />
            <div className="absolute right-8 bottom-8 hidden h-40 w-40 rotate-3 overflow-hidden rounded-3xl ring-4 ring-white/20 md:block">
              <Image src="/images/anniversaire-table.webp" alt="Table d'anniversaire décorée" fill sizes="160px" className="object-cover" />
            </div>
            <h2 className="max-w-2xl text-4xl font-semibold text-white sm:text-5xl">Comment se passe la réservation ?</h2>
            <ol className="relative mt-10 grid gap-8 md:grid-cols-3 md:pr-48">
              {[
                { t: "Votre demande", d: "Par téléphone, e-mail ou formulaire, en précisant l'âge de l'enfant, la date souhaitée et le nombre d'invités." },
                { t: "Notre proposition", d: "Nous vous recontactons avec une formule adaptée et les disponibilités." },
                { t: "La fête !", d: "Le jour J, vous profitez : nous nous occupons du reste." },
              ].map((s, i) => (
                <li key={s.t}>
                  <span className="font-display text-6xl font-bold text-mustard">0{i + 1}</span>
                  <h3 className="mt-2 text-2xl text-white">{s.t}</h3>
                  <p className="mt-2 text-white/75">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </section>

      <section id="demande" className="relative mt-16 scroll-mt-24 bg-shell">
        <Wave color="var(--color-shell)" flip className="absolute -top-[49px] sm:-top-[79px]" />
        <Star className="top-14 right-[8%] h-12 w-12 animate-spin-slow" color="var(--color-coral)" />
        <div className="container-x grid gap-12 py-24 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SectionTitle
              align="left"
              eyebrow="Pour une formule anniversaire"
              title="Contactez-nous"
              intro="Pour une demande de réservation d'anniversaire, contactez-nous par téléphone, par e-mail ou via ce formulaire. Pensez à préciser l'âge de l'enfant."
            />
            <Reveal delay={0.2}>
              <div className="mt-8 space-y-3 text-lg">
                <a href={`tel:${SITE.phoneHref}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold transition hover:-translate-y-1">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-tomato text-white">📞</span>
                  {SITE.phone}
                </a>
                <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold transition hover:-translate-y-1">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-sage text-white">✉️</span>
                  {SITE.email}
                </a>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.1} className="card p-6 sm:p-10 lg:col-span-3">
            <RequestForm
              type="anniversaire"
              submitLabel="Envoyer ma demande"
              successTitle="Youpi, demande envoyée !"
              successText="Nous vous recontactons rapidement avec une proposition."
              fields={[
                { name: "prenom_enfant", label: "Prénom de l'enfant", half: true },
                { name: "age", label: "Âge de l'enfant", required: true, half: true, placeholder: "Ex. : 4 ans" },
                { name: "date", label: "Date souhaitée", type: "date", half: true },
                { name: "invites", label: "Nombre d'enfants invités", type: "number", half: true, min: 1 },
                { name: "name", label: "Votre nom", required: true, half: true },
                { name: "phone", label: "Téléphone", type: "tel", required: true, half: true },
                { name: "email", label: "E-mail", type: "email" },
                { name: "message", label: "Vos envies, thème, questions…", type: "textarea" },
              ]}
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}
