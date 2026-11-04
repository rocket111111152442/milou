import { CalendarClock, BellRing, Rocket } from "lucide-react";
import { formatDateTime } from "@waverti/types";

/** Les trois temps d'un essai, à partir de la date de fin réelle de l'abonnement (rappel environ 24 h avant). */
export function TrialTimeline({ trialEndsAt, cancelAtPeriodEnd }: { trialEndsAt: string; cancelAtPeriodEnd: boolean }) {
  const end = new Date(trialEndsAt);
  const reminder = new Date(end.getTime() - 24 * 3600 * 1000);
  const items = [
    { icon: <Rocket />, title: "Essai en cours", text: "Aucun prélèvement pendant l'essai.", tone: "bg-[linear-gradient(135deg,#0b7350,#14946a)]" },
    { icon: <BellRing />, title: "Rappel par e-mail", text: `Vers le ${formatDateTime(reminder.toISOString())}, environ 24 h avant la fin.`, tone: "bg-[linear-gradient(135deg,#1d3fd6,#3b6bff)]" },
    {
      icon: <CalendarClock />,
      title: cancelAtPeriodEnd ? "Fin de l'essai" : "Fin de l'essai et premier prélèvement",
      text: cancelAtPeriodEnd ? `Le ${formatDateTime(end.toISOString())}. Résiliation enregistrée : aucun prélèvement.` : `Le ${formatDateTime(end.toISOString())}, sauf résiliation avant cette date.`,
      tone: "bg-[linear-gradient(135deg,#5a2de0,#8a3bff)]",
    },
  ];
  return (
    <ol aria-label="Déroulement de l'essai" className="grid gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <li key={it.title} className="card-glass flex gap-3 rounded-2xl p-4 shadow-[var(--shadow-card)]">
          <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl text-white [&_svg]:size-4 ${it.tone}`}>
            {it.icon}
          </span>
          <div>
            <p className="text-sm font-semibold">{it.title}</p>
            <p className="text-xs leading-relaxed text-ink-soft">{it.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
