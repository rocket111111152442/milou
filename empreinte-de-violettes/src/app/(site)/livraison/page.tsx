import type { Metadata } from "next";
import { RunningHead } from "@/components/herbier/Elements";
import { FaqList } from "@/components/herbier/FaqList";
import { Recevoir } from "@/components/herbier/home/Recevoir";
import { PageHead } from "@/components/herbier/PageHead";
import { getDelivery, getFaqs } from "@/lib/catalog";
import { DAYS, hhmm } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Livraison & retrait",
  description: "Livraison de fleurs à Six-Fours-les-Plages, Sanary, La Seyne, Ollioules, Bandol et Toulon. Retrait gratuit en boutique et Drive.",
};

export default async function DeliveryPage() {
  const [delivery, faqs] = await Promise.all([getDelivery(), getFaqs()]);
  const slots = delivery.slots;
  const closed = delivery.closedDays.map((d) => DAYS[d].toLowerCase());
  return (
    <>
      <PageHead
        kicker="Livraison & retrait"
        folio="Six-Fours et alentours"
        title="Vos fleurs,"
        accent="jusqu'à votre porte"
        intro={`Nous livrons nous-mêmes, en voiture, avec le soin d'un bouquet qu'on porte à la main. Commandé avant ${hhmm(delivery.sameDayCutoff)}, livré le jour même ; jusqu'à ${delivery.maxDaysAhead} jours à l'avance pour une date précise.`}
        plate="eucalyptus"
      />
      <Recevoir delivery={delivery} standalone />
      <section className="wrap grid gap-16 pb-24 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <RunningHead left="Créneaux" />
          <div className="mt-6 space-y-3 font-text text-[1.05rem]">
            {slots.map((s) => (
              <div key={s.id} className="flex items-baseline">
                <span className="font-display text-[1.3rem]">{s.label.split("·")[0].trim()}</span>
                <span className="leader" />
                <span className="tab text-ink-soft">
                  {hhmm(s.from)} – {hhmm(s.to)}
                </span>
              </div>
            ))}
          </div>
          <p className="body-text mt-6 !text-[1rem]">
            Préparation minimum : {delivery.leadTimeHours} heures.{closed.length > 0 && <> Pas de livraison le {closed.join(" ni le ")}.</>}
          </p>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <RunningHead left="Questions de livraison" />
          <div className="mt-6">
            <FaqList faqs={faqs.filter((f) => /livraison|retrait/i.test(f.category))} />
          </div>
        </div>
      </section>
    </>
  );
}
