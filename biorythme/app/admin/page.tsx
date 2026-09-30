import type { Metadata } from "next";
import AdminDashboard from "@/components/admin/AdminDashboard";
import LoginForm from "@/components/admin/LoginForm";
import Logo from "@/components/Logo";
import { isAdmin, isAdminConfigured } from "@/lib/admin-auth";
import { addDays, dayKey, mondayOf, parisToIso } from "@/lib/format";
import { adminClient } from "@/lib/supabase-admin";
import { SESSION_SELECT, type Booking, type Coach, type Course, type Room, type SessionFull } from "@/lib/types";

export const metadata: Metadata = { title: "Espace gérante", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  if (!isAdminConfigured()) {
    return <Notice title="Espace gérante non configuré" text="Définissez la variable ADMIN_PASSWORD sur Vercel." />;
  }
  if (!(await isAdmin())) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="w-full max-w-sm">
          <Logo className="text-4xl" />
          <h1 className="font-display mt-8 text-5xl">Espace gérante</h1>
          <p className="mt-2 text-muted">Planning, salles, cours et inscrits.</p>
          <LoginForm />
        </div>
      </div>
    );
  }

  let db;
  try {
    db = adminClient();
  } catch {
    return (
      <Notice
        title="Base de données non reliée"
        text="Reliez une base Supabase au projet Vercel (Storage → Connect), puis redéployez."
      />
    );
  }

  const { week } = await searchParams;
  const monday = mondayOf(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : dayKey(new Date()));
  const from = parisToIso(monday, "00:00");
  const to = parisToIso(addDays(monday, 7), "00:00");

  const [rooms, coaches, courses, sessions] = await Promise.all([
    db.from("bio_rooms").select("*").order("club").order("position"),
    db.from("bio_coaches").select("*").order("name"),
    db.from("bio_courses").select("*").order("name"),
    db.from("bio_sessions").select(SESSION_SELECT).gte("starts_at", from).lt("starts_at", to).order("starts_at"),
  ]);

  const firstError = rooms.error || coaches.error || courses.error || sessions.error;
  if (firstError) {
    return <Notice title="Erreur base de données" text={firstError.message} />;
  }

  const ids = (sessions.data ?? []).map((s) => s.id);
  const bookings = ids.length
    ? await db
        .from("bio_bookings")
        .select("id, session_id, name, email, phone, status, created_at")
        .in("session_id", ids)
        .eq("status", "confirmed")
        .order("created_at")
    : { data: [] as Booking[] };

  return (
    <AdminDashboard
      monday={monday}
      rooms={(rooms.data ?? []) as Room[]}
      coaches={(coaches.data ?? []) as Coach[]}
      courses={(courses.data ?? []) as Course[]}
      sessions={(sessions.data ?? []) as SessionFull[]}
      bookings={(bookings.data ?? []) as Booking[]}
    />
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="font-display text-5xl">{title}</h1>
        <p className="mt-3 text-muted">{text}</p>
      </div>
    </div>
  );
}
