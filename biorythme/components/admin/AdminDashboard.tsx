"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import Logo from "../Logo";
import { logoutAction } from "@/app/admin/actions";
import { CLUBS, type ClubId } from "@/lib/site";
import type { Booking, Coach, Course, Room, SessionFull } from "@/lib/types";
import PlanningBoard from "./PlanningBoard";
import RefsEditor from "./RefsEditor";
import MembersList, { type AdminMember } from "./MembersList";
import RealtimeRefresh from "./RealtimeRefresh";
import { Toast } from "./ui";

export type AdminData = {
  monday: string;
  rooms: Room[];
  coaches: Coach[];
  courses: Course[];
  sessions: SessionFull[];
  bookings: Booking[];
  members: AdminMember[];
};

export type Notify = (message: string, tone?: "ok" | "error") => void;

const TABS = [
  { id: "planning", label: "Planning" },
  { id: "rooms", label: "Salles" },
  { id: "courses", label: "Cours" },
  { id: "coaches", label: "Coachs" },
  { id: "members", label: "Membres" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminDashboard(data: AdminData) {
  const [tab, setTab] = useState<Tab>("planning");
  const [club, setClub] = useState<"all" | ClubId>("all");
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);

  const notify: Notify = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-dvh">
      <RealtimeRefresh />
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.15em] text-muted sm:inline">
              Espace gérante
            </span>
          </div>
          <nav className="order-last flex w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 sm:order-none sm:w-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${tab === t.id ? "text-ink" : "text-bone/70"}`}
              >
                {tab === t.id && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-full bg-volt" />}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/planning" target="_blank" className="rounded-full border border-line px-4 py-2 text-sm hover:border-bone/40">
              Voir le site ↗
            </Link>
            <form action={logoutAction}>
              <button className="rounded-full px-3 py-2 text-sm text-muted hover:text-bone">Déconnexion</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6">
        {tab === "planning" && (
          <>
            <div className="mb-6 flex gap-1 rounded-full border border-line bg-surface p-1 sm:w-fit">
              {(["all", "six-fours", "sanary"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setClub(c)}
                  className={`flex-1 rounded-full px-4 py-2 text-sm ${club === c ? "bg-bone font-semibold text-ink" : "text-bone/70"}`}
                >
                  {c === "all" ? "Tous les clubs" : CLUBS[c].city}
                </button>
              ))}
            </div>
            <PlanningBoard {...data} club={club} notify={notify} />
          </>
        )}
        {tab === "rooms" && <RefsEditor kind="rooms" items={data.rooms} notify={notify} />}
        {tab === "courses" && <RefsEditor kind="courses" items={data.courses} notify={notify} />}
        {tab === "coaches" && <RefsEditor kind="coaches" items={data.coaches} notify={notify} />}
        {tab === "members" && <MembersList members={data.members} notify={notify} />}
      </main>

      <Toast message={toast?.message ?? null} tone={toast?.tone ?? "ok"} />
    </div>
  );
}
