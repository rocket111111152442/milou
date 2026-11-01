import * as React from "react";
import { Check, Lightbulb } from "lucide-react";
import { cn } from "../lib/cn";

/** Bandeau d'accueil coloré : titre clair, phrase d'aide et actions principales. Le texte reste sur un fond sombre (contraste ≥ 7:1). */
export function HeroBanner({
  eyebrow,
  title,
  description,
  actions,
  aside,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("hero-banner relative overflow-hidden rounded-3xl p-6 text-white shadow-lift sm:p-8", className)}>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          {eyebrow ? <p className="text-sm font-medium text-white/80">{eyebrow}</p> : null}
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
          {description ? <p className="text-base leading-relaxed text-white/85">{description}</p> : null}
          {actions ? <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </section>
  );
}

const tileTones = {
  blue: "bg-tint-blue text-[#1d3fd6]",
  violet: "bg-tint-violet text-[#6a1fd6]",
  green: "bg-tint-green text-success",
  amber: "bg-tint-amber text-[#8a3b00]",
  red: "bg-tint-red text-danger",
} as const;
export type TileTone = keyof typeof tileTones;

/** Version pleine (icône blanche sur dégradé) : accents forts, jamais sous un texte long. */
const solidTones: Record<TileTone, string> = {
  blue: "bg-[linear-gradient(135deg,#1d3fd6,#3b6bff)] text-white",
  violet: "bg-[linear-gradient(135deg,#5a2de0,#8a3bff)] text-white",
  green: "bg-[linear-gradient(135deg,#0b7350,#14946a)] text-white",
  amber: "bg-[linear-gradient(135deg,#8a3b00,#c26a00)] text-white",
  red: "bg-[linear-gradient(135deg,#a8142d,#d4304a)] text-white",
};

/** Barre d'accent en haut d'une carte, selon la tonalité. */
export const accentBar: Record<TileTone, string> = {
  blue: "before:bg-[linear-gradient(90deg,#1d3fd6,#3b9bff)]",
  violet: "before:bg-[linear-gradient(90deg,#5a2de0,#ed4df5)]",
  green: "before:bg-[linear-gradient(90deg,#0b7350,#2bc48a)]",
  amber: "before:bg-[linear-gradient(90deg,#c26a00,#ffb020)]",
  red: "before:bg-[linear-gradient(90deg,#a8142d,#ff6a85)]",
};

/** Pastille d'icône colorée (teintée par défaut, `solid` pour une version pleine). */
export function IconTile({ icon, tone = "blue", solid, className }: { icon: React.ReactNode; tone?: TileTone; solid?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid size-11 shrink-0 place-items-center rounded-2xl [&_svg]:size-5", solid ? solidTones[tone] : tileTones[tone], className)}>
      {icon}
    </span>
  );
}

const statSurface: Record<TileTone, string> = {
  blue: "border-blue/15 bg-[linear-gradient(135deg,#dfe8ff,#eef2ff)]",
  violet: "border-violet/15 bg-[linear-gradient(135deg,#ece0ff,#f6efff)]",
  green: "border-success/15 bg-[linear-gradient(135deg,#d9f3e8,#ecf9f2)]",
  amber: "border-warning/20 bg-[linear-gradient(135deg,#ffe9c2,#fff4de)]",
  red: "border-danger/15 bg-[linear-gradient(135deg,#ffdce2,#ffeef1)]",
};

/** Indicateur clé : un chiffre, une phrase simple, une icône colorée. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "blue",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone?: TileTone;
}) {
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border p-5 shadow-[var(--shadow-card)]", statSurface[tone])}>
      <IconTile icon={icon} tone={tone} solid />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        <p className="font-display text-2xl font-semibold leading-tight text-ink">{value}</p>
        {hint ? <p className="truncate text-xs text-ink-soft">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Section de page : carte avec un titre accompagné d'une icône, un sous-titre facultatif et une action à droite. */
export function Section({
  title,
  description,
  icon,
  tone = "blue",
  action,
  children,
  className,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: TileTone;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={titleId} className={cn("card-glass relative overflow-hidden rounded-2xl p-5 shadow-[var(--shadow-card)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:content-[''] sm:p-6", accentBar[tone], className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon ? <IconTile icon={icon} tone={tone} solid className="size-9 rounded-xl [&_svg]:size-4" /> : null}
          <div>
            <h2 id={titleId} className="font-display text-lg font-semibold leading-tight">
              {title}
            </h2>
            {description ? <p className="text-sm text-ink-soft">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0 text-sm">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Conseil contextuel : une phrase, jamais un paragraphe. */
export function Tip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2.5 rounded-xl border border-blue/15 bg-tint-blue px-3.5 py-3 text-sm leading-relaxed text-ink", className)}>
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Progression par étapes : barre colorée + libellés. `current` commence à 0. */
export function StepProgress({ steps, current, label = "Étapes" }: { steps: string[]; current: number; label?: string }) {
  const pct = steps.length > 1 ? Math.round((current / (steps.length - 1)) * 100) : 100;
  return (
    <div className="flex flex-col gap-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-waverti-gradient transition-[width] duration-500 ease-[var(--ease-out-soft)]" style={{ width: `${Math.max(8, pct)}%` }} />
      </div>
      <ol className="flex items-center justify-between gap-2 text-xs font-medium sm:text-sm" aria-label={label}>
        {steps.map((s, i) => (
          <li key={s} aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-[11px] font-semibold transition-colors",
                i < current ? "bg-success text-white" : i === current ? "bg-blue text-white" : "bg-surface-strong text-muted-fg",
              )}
            >
              {i < current ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn(i === current ? "text-ink" : "text-muted-fg", "hidden sm:inline")}>{s}</span>
            <span className="sr-only">{i < current ? " (terminée)" : i === current ? " (en cours)" : ""}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
