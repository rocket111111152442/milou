"use client";
import * as React from "react";
import { cn } from "@waverti/ui";

/**
 * Préférences d'affichage, propres à ce navigateur (aucune donnée envoyée au serveur) : animations, taille du texte, contraste.
 * Elles sont appliquées par des attributs sur <html>, lus par les styles partagés (@waverti/ui/styles.css).
 */
const KEY = "waverti-appearance";

export interface Appearance {
  motion: "full" | "reduced";
  text: "normal" | "large";
  contrast: "normal" | "high";
}
const DEFAULTS: Appearance = { motion: "full", text: "normal", contrast: "normal" };

function read(): Appearance {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<Appearance>;
    return {
      motion: raw.motion === "reduced" ? "reduced" : "full",
      text: raw.text === "large" ? "large" : "normal",
      contrast: raw.contrast === "high" ? "high" : "normal",
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(a: Appearance) {
  const el = document.documentElement;
  const set = (name: string, value: string | null) => (value ? el.setAttribute(name, value) : el.removeAttribute(name));
  set("data-motion", a.motion === "reduced" ? "reduced" : null);
  set("data-text", a.text === "large" ? "large" : null);
  set("data-contrast", a.contrast === "high" ? "high" : null);
}

/** À placer une fois dans l'espace connecté : applique les préférences enregistrées. */
export function AppearanceBoot() {
  React.useEffect(() => apply(read()), []);
  return null;
}

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; title: string; hint: string }> }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-ink">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex flex-col gap-0.5 rounded-xl border p-3.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue",
                on ? "border-blue bg-tint-blue shadow-soft" : "border-line bg-white/70 hover:border-line-strong",
              )}
            >
              <span className="font-medium">{o.title}</span>
              <span className="text-xs text-ink-soft">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AppearanceSettings() {
  const [a, setA] = React.useState<Appearance>(DEFAULTS);
  React.useEffect(() => setA(read()), []);
  const update = (patch: Partial<Appearance>) => {
    const next = { ...a, ...patch };
    setA(next);
    apply(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible (navigation privée) : la préférence vaut pour cette page seulement */
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <Choice
        label="Animations"
        value={a.motion}
        onChange={(motion) => update({ motion })}
        options={[
          { value: "full", title: "Complètes", hint: "Transitions et petites animations." },
          { value: "reduced", title: "Réduites", hint: "Aucun mouvement : plus calme, plus économe." },
        ]}
      />
      <Choice
        label="Taille du texte"
        value={a.text}
        onChange={(text) => update({ text })}
        options={[
          { value: "normal", title: "Normale", hint: "Taille standard." },
          { value: "large", title: "Agrandie", hint: "Texte et interface 12,5 % plus grands." },
        ]}
      />
      <Choice
        label="Contraste"
        value={a.contrast}
        onChange={(contrast) => update({ contrast })}
        options={[
          { value: "normal", title: "Standard", hint: "Couleurs habituelles." },
          { value: "high", title: "Renforcé", hint: "Textes secondaires plus foncés, bordures plus marquées." },
        ]}
      />
      <p className="text-xs text-ink-soft">Ces choix sont enregistrés dans ce navigateur : ils ne suivent pas votre compte sur un autre appareil. Votre réglage « mouvement réduit » du système est toujours respecté.</p>
    </div>
  );
}
