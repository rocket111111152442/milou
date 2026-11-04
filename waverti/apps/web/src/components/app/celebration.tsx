"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, BellRing, CalendarClock, PartyPopper, Rocket } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "@waverti/ui";

const COLORS = ["#00e5ff", "#245bff", "#8028ff", "#ed4df5", "#ffb020", "#14946a"];

/**
 * Animation de confirmation d'achat (motion design) : affichée une seule fois par retour de paiement vérifié par le serveur.
 * Rien n'est inventé : la formule, l'essai et la date viennent de l'abonnement réel. Mouvement réduit : pas de confettis, apparition simple.
 */
export function Celebration({ storageKey, planName, trialing, trialEndsAtLabel }: { storageKey: string; planName: string | null; trialing: boolean; trialEndsAtLabel: string | null }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const cta = React.useRef<HTMLAnchorElement>(null);

  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey)) return;
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* stockage indisponible : l'animation s'affiche, et pourra se répéter */
    }
    setOpen(true);
  }, [storageKey]);

  React.useEffect(() => {
    if (!open) return;
    cta.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pieces = React.useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        color: COLORS[i % COLORS.length],
        delay: `${((i * 53) % 100) / 100}s`,
        dur: `${3 + ((i * 31) % 20) / 10}s`,
        dx: `${((i * 41) % 160) - 80}px`,
        rot: `${360 + ((i * 67) % 540)}deg`,
      })),
    [],
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="celebration"
          className="fixed inset-0 z-[80] grid place-items-center bg-[#0d0c2b]/80 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
        >
          {!reduced ? (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              {pieces.map((p, i) => (
                <span key={i} className="confetti-piece" style={{ left: p.left, background: p.color, ["--delay" as string]: p.delay, ["--dur" as string]: p.dur, ["--dx" as string]: p.dx, ["--rot" as string]: p.rot }} />
              ))}
            </div>
          ) : null}
          <motion.div
            className="grain relative w-full max-w-lg overflow-hidden rounded-[32px] bg-white p-8 text-center shadow-lift sm:p-10"
            initial={reduced ? false : { scale: 0.86, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-waverti-gradient" />
            <motion.div
              className="mx-auto grid size-24 place-items-center rounded-full bg-[linear-gradient(135deg,#0b7350,#2bc48a)] shadow-[0_12px_40px_-8px_rgba(11,115,80,0.6)]"
              initial={reduced ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.15 }}
            >
              <svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path className="anim-draw" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </motion.div>
            <h2 id="celebration-title" className="mt-6 font-display text-3xl font-extrabold tracking-tight">
              Achat validé !
            </h2>
            <p className="mt-2 text-ink-soft">
              {trialing ? "Votre essai gratuit de 3 jours commence maintenant" : "Votre abonnement est actif"}
              {planName ? ` — formule ${planName}.` : "."}
            </p>
            {trialing ? (
              <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-3 text-left text-sm">
                <li className="flex items-start gap-3 rounded-xl bg-tint-green px-4 py-3">
                  <Rocket className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>Aucun prélèvement pendant l'essai. Vos quotas pendant l'essai s'affichent sur la page Abonnement.</span>
                </li>
                <li className="flex items-start gap-3 rounded-xl bg-tint-blue px-4 py-3">
                  <BellRing className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" />
                  <span>Un rappel vous est envoyé par e-mail environ 24 h avant la fin de l'essai.</span>
                </li>
                {trialEndsAtLabel ? (
                  <li className="flex items-start gap-3 rounded-xl bg-tint-violet px-4 py-3">
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden="true" />
                    <span>
                      L'essai se termine le <strong>{trialEndsAtLabel}</strong>. Vous pouvez résilier en ligne avant cette date.
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : null}
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link ref={cta} href="/app" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
                <PartyPopper className="size-4" aria-hidden="true" /> Découvrir Waverti <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold text-ink-soft hover:bg-surface focus-visible:outline-2 focus-visible:outline-blue">
                Rester sur cette page
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
