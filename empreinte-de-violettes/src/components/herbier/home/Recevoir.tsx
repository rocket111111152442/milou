import Link from "next/link";
import { euro, hhmm } from "@/lib/format";
import type { DeliverySettings } from "@/lib/types";
import { roman } from "@/lib/roman";
import { Fade, RunningHead, Words } from "../Elements";
import { PostcodeCheck } from "../PostcodeCheck";

export function Recevoir({ delivery, numeral = "VI", standalone = false }: { delivery: DeliverySettings; numeral?: string; standalone?: boolean }) {
  const cutoff = hhmm(delivery.sameDayCutoff);
  const modes = [
    delivery.deliveryEnabled && { title: "Livraison", text: `Nous livrons nous-mêmes, en voiture, à domicile, au bureau, au funérarium. Le jour même pour toute commande passée avant ${cutoff}.` },
    delivery.pickupEnabled && { title: "Retrait en boutique", text: delivery.pickupNote },
    delivery.driveEnabled && { title: "Drive", text: delivery.driveNote },
  ].filter(Boolean) as { title: string; text: string }[];
  const zones = delivery.zones.filter((z) => z.active);
  return (
    <section className={standalone ? "wrap pb-24" : "wrap py-24 sm:py-32"}>
      {!standalone && <RunningHead left="Recevoir vos fleurs" right={numeral} />}
      {!standalone && (
        <h2 className="h-section mt-14 max-w-[18ch]">
          <Words text="Livrées par nos soins," /> <em><Words text="ou à retirer" delay={0.12} /></em>
        </h2>
      )}
      <div className="mt-14 grid gap-10 border-t border-ink/15 pt-10 md:grid-cols-3 md:gap-12">
        {modes.map((m, i) => (
          <Fade key={m.title} delay={i * 0.1}>
            <p className="font-text text-[0.9rem] italic text-ink-muted">{roman(i + 1)}.</p>
            <h3 className="mt-2 font-display text-[1.8rem] leading-tight">{m.title}</h3>
            <p className="body-text mt-3 !text-[1.02rem]">{m.text}</p>
          </Fade>
        ))}
      </div>

      {delivery.deliveryEnabled && (
        <div className="mt-20 grid gap-14 lg:grid-cols-12 lg:gap-10">
          <Fade className="lg:col-span-7">
            <p className="sc mb-5 text-ink-muted">Tarifs de livraison</p>
            <table className="w-full font-text text-[1rem]">
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className="border-b border-ink/10 align-baseline">
                    <td className="py-4 pr-4">
                      <span className="block font-display text-[1.3rem] leading-tight">{z.name}</span>
                      <span className="block text-[0.9rem] italic text-ink-muted">{z.cities.join(", ")}</span>
                    </td>
                    <td className="tab whitespace-nowrap py-4 text-right">
                      <span className="block text-[1.1rem]">{euro(z.fee, { compact: true })}</span>
                      <span className="block text-[0.85rem] italic text-ink-muted">{z.freeFrom != null ? `offerte dès ${euro(z.freeFrom, { compact: true })}` : `minimum ${euro(z.minOrder, { compact: true })}`}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 font-text text-[0.92rem] italic text-ink-muted">Une autre commune ? Appelez-nous : nous trouvons presque toujours une solution.</p>
          </Fade>
          <Fade delay={0.15} className="lg:col-span-4 lg:col-start-9">
            <div className="sheet p-6 sm:p-8">
              <p className="sc text-ink-muted">Livrez-vous chez moi ?</p>
              <div className="mt-5">
                <PostcodeCheck cutoff={cutoff} />
              </div>
              {!standalone && (
                <Link href="/livraison" className="btn-line mt-2">
                  Tout savoir sur la livraison <span className="arrow">→</span>
                </Link>
              )}
            </div>
          </Fade>
        </div>
      )}
    </section>
  );
}
