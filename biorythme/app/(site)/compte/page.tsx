import type { Metadata } from "next";
import AccountView, { type MyBooking } from "@/components/account/AccountView";
import AuthForm from "@/components/account/AuthForm";
import { SplitTitle } from "@/components/Reveal";
import { currentMember } from "@/lib/member-auth";
import { adminClient } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const member = await currentMember();

  let bookings: MyBooking[] = [];
  if (member) {
    const { data } = await adminClient()
      .from("bio_bookings")
      .select(
        "id, created_at, session:bio_sessions(id, starts_at, duration_min, cancelled, course:bio_courses(name, color), room:bio_rooms(name, club))",
      )
      .eq("member_id", member.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(200);
    bookings = ((data ?? []) as unknown as MyBooking[]).filter((b) => b.session);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pt-36 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-volt">Espace membre</p>
      <h1 className="font-display mt-4 text-7xl sm:text-9xl">
        <SplitTitle lines={[member ? `Salut ${member.first_name}` : "Mon compte"]} />
      </h1>
      <div className="mt-12">
        {member ? (
          <AccountView member={member} bookings={bookings} />
        ) : (
          <div className="max-w-md rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <AuthForm intro="Un seul compte pour réserver vos cours dans les deux clubs et retrouver vos réservations sur tous vos appareils." />
          </div>
        )}
      </div>
    </section>
  );
}
