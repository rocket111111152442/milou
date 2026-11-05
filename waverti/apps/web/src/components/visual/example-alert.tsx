import { cn } from "@waverti/ui";

/**
 * Exemple illustré (décoratif) : un prix suivi, sa courbe qui passe sous le seuil, et l'alerte reçue.
 * Valeurs d'exemple, aucune donnée réelle ; la page qui l'affiche l'étiquette comme telle.
 * Style volontairement sobre : aplats, trait net, ombre décalée, aucun halo ni dégradé.
 */
export function ExampleAlert({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative mx-auto w-full max-w-[460px] select-none pb-12 pr-4", className)}>
      <div className="-rotate-[1.5deg] rounded-2xl border-2 border-ink bg-white p-5 text-ink shadow-[8px_8px_0_0_#111118]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold leading-tight">Casque audio sans fil</p>
            <p className="mt-0.5 text-xs text-ink-soft">boutique-exemple.fr</p>
          </div>
          <span className="rounded-md border-2 border-ink bg-[#ffd84d] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">Exemple</span>
        </div>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="font-display text-4xl font-extrabold tabular-nums">94,90 €</span>
          <span className="text-sm text-ink-soft line-through">109,90 €</span>
        </div>
        <svg viewBox="0 0 380 110" className="mt-3 w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1="0" y1="62" x2="380" y2="62" stroke="#111118" strokeWidth="1.5" strokeDasharray="5 6" />
          <text x="4" y="56" fontSize="11" fill="#4f4f62" fontFamily="ui-monospace, monospace">seuil : 100 €</text>
          <polyline points="0,24 50,28 100,22 150,30 200,26 250,34 300,32" stroke="#9a9aab" strokeWidth="3" />
          <polyline points="300,32 340,88" stroke="#245bff" strokeWidth="4" />
          <circle cx="340" cy="88" r="7" fill="#ffd84d" stroke="#111118" strokeWidth="2.5" />
        </svg>
      </div>
      <div className="absolute -bottom-0 right-0 w-[78%] rotate-[2deg] rounded-xl border-2 border-ink bg-[#245bff] px-4 py-3 text-white shadow-[5px_5px_0_0_#111118]">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/90">Nouvelle alerte</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug">Prix sous 100 € : 94,90 € au lieu de 109,90 €.</p>
      </div>
    </div>
  );
}
