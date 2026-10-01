import type { Metadata } from "next";
import Planning from "@/components/booking/Planning";
import { SplitTitle } from "@/components/Reveal";
import { fetchPublicSessions } from "@/lib/queries";
import { isSupabaseConfigured, publicClient } from "@/lib/supabase";
import type { SessionFull } from "@/lib/types";
import { myBookedSessionIds } from "@/app/actions";

export const metadata: Metadata = { title: "Planning & réservation" };
export const dynamic = "force-dynamic";

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ club?: string }> }) {
  const { club } = await searchParams;
  let sessions: SessionFull[] = [];
  let failed = false;
  let booked: string[] = [];
  const client = publicClient();
  if (client) {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 15 * 86_400_000);
    try {
      [sessions, booked] = await Promise.all([
        fetchPublicSessions(client, from.toISOString(), to.toISOString()),
        myBookedSessionIds(),
      ]);
    } catch {
      failed = true;
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pb-10 pt-36 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-volt">Cours collectifs</p>
      <h1 className="font-display mt-4 text-7xl sm:text-9xl">
        <SplitTitle lines={["Planning"]} />
      </h1>
      <p className="mt-4 max-w-lg text-bone/75">
        Tous les cours de Six-Fours et Sanary au même endroit. Choisissez un créneau, les places se mettent à jour en
        direct.
      </p>

      <div className="mt-12">
        {!isSupabaseConfigured || failed ? (
          <div className="rounded-3xl border border-dashed border-line p-10 text-center">
            <p className="font-display text-4xl">Bientôt disponible</p>
            <p className="mt-3 text-muted">
              La réservation en ligne est en cours d&apos;activation. En attendant, contactez votre club par téléphone.
            </p>
          </div>
        ) : (
          <Planning initial={sessions} initialBooked={booked} initialClub={club === "six-fours" || club === "sanary" ? club : "all"} />
        )}
      </div>
    </section>
  );
}
