"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Activity, ActivityCategory, Session } from "@/lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS, KIND_LABELS } from "@/lib/types";
import { formatDate, formatTime, price } from "@/lib/format";
import { ActivityCardInner } from "./ActivityCardInner";
import { RequestForm } from "./RequestForm";

type Filter = "tous" | ActivityCategory;

export function ActivityExplorer({
  activities,
  today,
  catalogEyebrow = "Tous nos ateliers",
  catalogTitle = "Trouvez l'atelier qui vous ressemble",
}: {
  activities: Activity[];
  today: string;
  catalogEyebrow?: string;
  catalogTitle?: string;
}) {
  const [filter, setFilter] = useState<Filter>("tous");
  const [selected, setSelected] = useState<{ a: Activity; s?: Session } | null>(null);

  const upcoming = useMemo(
    () =>
      activities.map((a) => ({ ...a, sessions: a.sessions.filter((s) => s.date >= today) })),
    [activities, today]
  );

  const cats = useMemo(() => {
    const set = new Set(upcoming.map((a) => a.category));
    return (Object.keys(CATEGORY_LABELS) as ActivityCategory[]).filter((c) => set.has(c));
  }, [upcoming]);

  const list = upcoming.filter((a) => filter === "tous" || a.category === filter);

  const agenda = useMemo(() => {
    const rows = upcoming.flatMap((a) => a.sessions.map((s) => ({ a, s })));
    rows.sort((x, y) => (x.s.date + x.s.start).localeCompare(y.s.date + y.s.start));
    const groups = new Map<string, typeof rows>();
    rows.forEach((r) => groups.set(r.s.date, [...(groups.get(r.s.date) ?? []), r]));
    return [...groups.entries()];
  }, [upcoming]);

  return (
    <>
      {/* PLANNING */}
      <section id="planning" className="container-x scroll-mt-28">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="eyebrow">Planning</span>
            <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">Les prochaines séances</h2>
          </div>
          <p className="max-w-sm text-ink-soft">Places limitées : réservez en ligne en un clic, nous vous confirmons rapidement.</p>
        </div>

        {agenda.length === 0 ? (
          <p className="mt-8 rounded-3xl bg-shell p-8 text-center text-lg">
            Le prochain planning arrive très bientôt ! Suivez-nous sur Instagram ou appelez-nous au 09 56 60 77 74.
          </p>
        ) : (
          <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-6 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {agenda.map(([date, rows], gi) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: gi * 0.06, duration: 0.6 }}
                className="card w-[85%] shrink-0 snap-start p-5 sm:w-auto"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-mustard text-center leading-none">
                    <span className="font-display text-2xl font-bold">{formatDate(date, { day: "numeric" })}</span>
                    <span className="text-xs font-extrabold uppercase">{formatDate(date, { month: "short" })}</span>
                  </div>
                  <p className="font-display text-xl font-semibold capitalize">{formatDate(date, { weekday: "long" })}</p>
                </div>
                <ul className="mt-4 space-y-3">
                  {rows.map(({ a, s }) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setSelected({ a, s })}
                        className="group flex w-full items-center gap-3 rounded-2xl bg-cream p-3 text-left transition hover:bg-shell"
                      >
                        <span className={`h-10 w-1.5 shrink-0 rounded-full ${CATEGORY_COLORS[a.category]}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-ink-soft">
                            {formatTime(s.start)} – {formatTime(s.end)} · {a.ageLabel}
                          </span>
                          <span className="block truncate font-display text-lg font-semibold">{a.title}</span>
                          {typeof s.spots === "number" && (
                            <span className={`text-xs font-bold ${s.spots <= 2 ? "text-tomato" : "text-sage-deep"}`}>
                              {s.spots === 0 ? "Complet" : `${s.spots} place${s.spots > 1 ? "s" : ""} restante${s.spots > 1 ? "s" : ""}`}
                            </span>
                          )}
                        </span>
                        <span className="rounded-full bg-tomato px-3 py-1.5 text-sm font-bold text-white transition group-hover:scale-105">Réserver</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* CATALOGUE */}
      <section id="catalogue" className="container-x mt-24 scroll-mt-28">
        <div className="text-center">
          <span className="eyebrow">{catalogEyebrow}</span>
          <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">{catalogTitle}</h2>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Filtrer par thème">
          {(["tous", ...cats] as Filter[]).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={filter === c}
              onClick={() => setFilter(c)}
              className={`relative rounded-full px-5 py-2.5 font-display font-semibold transition ${filter === c ? "text-white" : "bg-white text-ink ring-1 ring-ink/10 hover:ring-ink/30"}`}
            >
              {filter === c && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{c === "tous" ? "Tous" : CATEGORY_LABELS[c]}</span>
            </button>
          ))}
        </div>

        <motion.div layout className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((a) => (
              <motion.button
                layout
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.35 }}
                onClick={() => setSelected({ a })}
                className="text-left"
              >
                <ActivityCardInner a={a} />
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      </section>

      <BookingDialog selected={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function BookingDialog({ selected, onClose }: { selected: { a: Activity; s?: Session } | null; onClose: () => void }) {
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("lenis-stopped");
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("lenis-stopped");
      document.body.style.overflow = "";
    };
  }, [selected, onClose]);

  const a = selected?.a;
  const sessionOptions = a?.sessions.map((s) => `${formatDate(s.date)} · ${formatTime(s.start)} – ${formatTime(s.end)}`) ?? [];
  const preset = selected?.s ? `${formatDate(selected.s.date)} · ${formatTime(selected.s.start)} – ${formatTime(selected.s.end)}` : undefined;

  return (
    <AnimatePresence>
      {a && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={a.title}
            data-lenis-prevent
            initial={{ y: 80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] bg-cream sm:rounded-[2rem]"
          >
            <button onClick={onClose} aria-label="Fermer" className="absolute top-4 right-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-2xl shadow ring-1 ring-ink/10 transition hover:rotate-90">
              ×
            </button>
            <div className="grid gap-0 sm:grid-cols-5">
              <div className="relative h-56 bg-white sm:col-span-2 sm:h-auto">
                <Image src={a.image} alt={a.title} fill sizes="400px" className="object-cover" />
              </div>
              <div className="p-6 sm:col-span-3 sm:p-8">
                <span className={`inline-block rounded-full ${CATEGORY_COLORS[a.category]} px-3 py-1 text-xs font-extrabold text-white uppercase`}>
                  {a.kind === "atelier" ? CATEGORY_LABELS[a.category] : KIND_LABELS[a.kind]}
                </span>
                <h2 className="mt-3 text-3xl font-semibold">{a.title}</h2>
                <p className="mt-1 font-bold text-sage-deep">
                  {a.ageLabel}
                  {a.duration ? ` · ${a.duration}` : ""} · {price(a.price)}
                  {a.priceNote ? ` (${a.priceNote})` : ""}
                </p>
                <p className="mt-3 text-ink-soft">{a.description}</p>
                {a.recurring && <p className="mt-2 font-bold">🗓 {a.recurring}</p>}
              </div>
            </div>
            <div className="border-t border-ink/10 p-6 sm:p-8">
              <h3 className="mb-4 text-2xl">Demande de réservation</h3>
              <RequestForm
                type="atelier"
                hidden={{ atelier: a.title }}
                submitLabel="Réserver ma place"
                successText="Nous vous confirmons votre place par téléphone ou e-mail très rapidement."
                fields={[
                  ...(sessionOptions.length
                    ? [{ name: "seance", label: "Séance", type: "select" as const, options: sessionOptions, defaultValue: preset, required: true }]
                    : [{ name: "seance", label: "Disponibilités souhaitées", placeholder: "Ex. : un samedi matin" }]),
                  { name: "name", label: "Nom et prénom", required: true, half: true },
                  { name: "phone", label: "Téléphone", type: "tel", required: true, half: true },
                  { name: "email", label: "E-mail", type: "email", half: true },
                  { name: "participants", label: "Nombre d'enfants", type: "number", defaultValue: "1", min: 1, half: true },
                  { name: "message", label: "Âge de l'enfant, questions…", type: "textarea" },
                ]}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
