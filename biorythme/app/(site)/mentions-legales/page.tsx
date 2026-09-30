import type { Metadata } from "next";
import { CONTACT_EMAIL, PHONE } from "@/lib/site";

export const metadata: Metadata = { title: "Mentions légales", robots: { index: false } };

export default function MentionsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-36 sm:px-6">
      <h1 className="font-display text-6xl sm:text-8xl">Mentions légales</h1>
      <div className="mt-12 grid gap-10 text-bone/80">
        <div>
          <h2 className="font-display text-3xl text-bone">Éditeur du site</h2>
          <p className="mt-3">
            Biorythme
            <br />
            429 boulevard de Léry, 83140 Six-Fours-les-Plages
            <br />
            Téléphone : <a href={`tel:${PHONE.href}`} className="underline">{PHONE.label}</a>
            <br />
            Email : <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
          </p>
        </div>
        <div>
          <h2 className="font-display text-3xl text-bone">Hébergement</h2>
          <p className="mt-3">
            Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com
            <br />
            Base de données : Supabase Inc. — supabase.com
          </p>
        </div>
        <div>
          <h2 className="font-display text-3xl text-bone">Données personnelles</h2>
          <p className="mt-3">
            Lors d&apos;une réservation, nous collectons votre nom, votre email et, si vous le souhaitez, votre téléphone.
            Ces données servent uniquement à la gestion des cours collectifs et ne sont accessibles qu&apos;à l&apos;équipe
            Biorythme. Vous pouvez demander leur consultation ou leur suppression à {CONTACT_EMAIL}.
          </p>
        </div>
      </div>
    </section>
  );
}
