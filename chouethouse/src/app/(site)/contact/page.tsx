import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { RequestForm } from "@/components/RequestForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact & accès – Chouet'House La Seyne-sur-Mer",
  description:
    "Chouet'House, 2496 avenue Pierre Auguste Renoir, 83500 La Seyne-sur-Mer. Ouvert du lundi au samedi de 9 h à 18 h. Tél. 09 56 60 77 74 – chouethouse@gmail.com.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="On papote ?"
        intro={<p>Une question sur un atelier, un anniversaire, une réservation ? Écrivez-nous ou passez nous voir, nous serons ravis de vous accueillir.</p>}
        color="peach"
      />
      <section className="container-x grid gap-10 pb-10 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          {[
            { e: "📍", t: "Adresse", v: <>{SITE.street}<br />{SITE.postalCode} {SITE.city}</>, href: SITE.mapsUrl, c: "bg-tomato" },
            { e: "📞", t: "Téléphone", v: SITE.phone, href: `tel:${SITE.phoneHref}`, c: "bg-mustard" },
            { e: "✉️", t: "E-mail", v: SITE.email, href: `mailto:${SITE.email}`, c: "bg-sage" },
            { e: "🕘", t: "Horaires", v: SITE.hours, c: "bg-coral" },
          ].map((x, i) => (
            <Reveal key={x.t} delay={i * 0.08}>
              {x.href ? (
                <a href={x.href} target={x.href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="card flex items-center gap-4 p-5 transition hover:-translate-y-1">
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${x.c} text-2xl`}>{x.e}</span>
                  <span>
                    <span className="block text-sm font-bold text-ink-soft">{x.t}</span>
                    <span className="font-display text-lg font-semibold">{x.v}</span>
                  </span>
                </a>
              ) : (
                <div className="card flex items-center gap-4 p-5">
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${x.c} text-2xl`}>{x.e}</span>
                  <span>
                    <span className="block text-sm font-bold text-ink-soft">{x.t}</span>
                    <span className="font-display text-lg font-semibold">{x.v}</span>
                  </span>
                </div>
              )}
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1} className="card p-6 sm:p-10 lg:col-span-3">
          <h2 className="mb-6 text-3xl font-semibold">Envoyez-nous un message</h2>
          <RequestForm
            type="contact"
            fields={[
              { name: "name", label: "Nom et prénom", required: true, half: true },
              { name: "phone", label: "Téléphone", type: "tel", half: true },
              { name: "email", label: "E-mail", type: "email", required: true },
              { name: "sujet", label: "Sujet", type: "select", options: ["Question générale", "Atelier", "Anniversaire", "Restauration", "Proposer un atelier", "Autre"] },
              { name: "message", label: "Message", type: "textarea", required: true },
            ]}
          />
        </Reveal>
      </section>
      <section className="container-x mt-10">
        <Reveal>
          <div className="aspect-[16/9] overflow-hidden rounded-[2.5rem] shadow-xl ring-8 ring-white sm:aspect-[21/9]">
            <iframe title="Plan d'accès Chouet'House" src={SITE.mapsEmbed} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </Reveal>
      </section>
    </>
  );
}
