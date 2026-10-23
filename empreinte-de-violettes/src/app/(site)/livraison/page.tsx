import type { Metadata } from "next";
import { Car, Clock, Store, Truck } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { DeliveryChecker } from "@/components/site/DeliveryChecker";
import { FaqList } from "@/components/site/FaqList";
import { PageHero } from "@/components/site/PageHero";
import { SectionTitle } from "@/components/site/SectionTitle";
import { getDelivery, getFaqs, getSettings } from "@/lib/catalog";
import { DAYS, euro } from "@/lib/format";
import { IMG } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Livraison, retrait & Drive",
  description: "Livraison de fleurs à Six-Fours-les-Plages, Sanary, La Seyne, Ollioules, Bandol et Toulon. Retrait gratuit en boutique et Drive.",
};

export default async function DeliveryPage() {
  const [delivery, faqs, settings] = await Promise.all([getDelivery(), getFaqs(), getSettings()]);
  const zones = delivery.zones.filter((z) => z.active);
  return (
    <>
      <PageHero
        eyebrow="Livraison & retrait"
        title="Vos fleurs,"
        accent="là où vous les attendez"
        intro={`Nous livrons nous-mêmes, en voiture, avec le soin d'une fleuriste. Commandez avant ${delivery.sameDayCutoff.replace(":", " h ").replace(" h 00", " h")} pour une livraison le jour même.`}
        image={IMG.kraftBouquet}
        crumbs={[{ href: "/livraison", label: "Livraison" }]}
      >
        <div className="mt-10 max-w-lg">
          <DeliveryChecker />
        </div>
      </PageHero>

      <section className="fern-paper bg-ivory py-28 text-noir">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
          <SectionTitle eyebrow="Zones & tarifs" title="Où livrons-" accent="nous ?" tone="light" size="md" />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {zones.map((z, i) => (
              <Reveal key={z.id} delay={i * 0.1} className="relative overflow-hidden rounded-[2rem] border border-noir/10 bg-white/70 p-8">
                <span className="absolute -right-6 -top-10 font-display text-[9rem] leading-none text-aubergine-200/50">{i + 1}</span>
                <Truck className="relative h-7 w-7 text-aubergine-600" strokeWidth={1.2} />
                <h3 className="relative mt-6 font-display text-3xl">{z.name}</h3>
                <p className="relative mt-2 text-sm text-noir/55">{z.cities.join(" · ")}</p>
                <p className="relative mt-1 text-xs text-noir/40">{z.postcodes.join(", ")}</p>
                <dl className="relative mt-8 space-y-2 border-t border-noir/10 pt-6 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-noir/60">Frais de livraison</dt>
                    <dd className="font-display text-2xl">{euro(z.fee)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-noir/60">Minimum de commande</dt>
                    <dd>{euro(z.minOrder, { compact: true })}</dd>
                  </div>
                  {z.freeFrom != null && (
                    <div className="flex justify-between text-aubergine-700">
                      <dt>Livraison offerte dès</dt>
                      <dd>{euro(z.freeFrom, { compact: true })}</dd>
                    </div>
                  )}
                </dl>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-sm text-noir/55">Une adresse hors zone ? Appelez-nous au {settings.phone} : nous trouvons toujours une solution.</p>
        </div>
      </section>

      <section id="retrait" className="bg-noir py-28">
        <div className="mx-auto grid max-w-[1600px] gap-12 px-6 sm:px-10 lg:grid-cols-3 lg:px-16">
          {[
            [Clock, "Créneaux", delivery.slots.map((s) => `${s.label} — ${s.days.map((d) => DAYS[d].slice(0, 3).toLowerCase()).join(", ")}`).join("\n")],
            [Store, "Retrait en boutique", delivery.pickupNote],
            [Car, "Drive", delivery.driveNote],
          ].map(([Icon, t, d], i) => {
            const I = Icon as typeof Clock;
            return (
              <Reveal key={t as string} delay={i * 0.1} className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.03] p-8">
                <I className="h-7 w-7 text-gold" strokeWidth={1.2} />
                <h3 className="mt-6 font-display text-3xl">{t as string}</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ivory/60">{d as string}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="fern-paper bg-paper py-28 text-noir">
        <div className="mx-auto max-w-[1100px] px-6 sm:px-10">
          <SectionTitle eyebrow="Questions fréquentes" title="Livraison &" accent="retrait" tone="light" size="md" />
          <div className="mt-10">
            <FaqList faqs={faqs.filter((f) => ["Livraison", "Retrait", "Paiement"].includes(f.category))} />
          </div>
        </div>
      </section>
    </>
  );
}
