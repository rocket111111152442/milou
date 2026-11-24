import type { CreditStatus } from "@/lib/ai/credits";

/** Shows the assistant's remaining tokens as a percentage only (no monetary amounts). */
export function TokenGauge({ s, compact = false }: { s: CreditStatus; compact?: boolean }) {
  const tone = s.exhausted || s.percentLeft <= 10 ? "bg-red-600" : s.percentLeft <= 25 ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className={compact ? "text-sm" : "text-base"}>
          Tokens restantes: <strong className={compact ? "text-xl" : "text-3xl"}>{s.exhausted ? 0 : s.percentLeft} %</strong>
        </p>
        {!s.exhausted && s.estimatedMessagesLeft !== null && (
          <p className="text-xs text-ink-muted">≈ {s.estimatedMessagesLeft.toLocaleString("es-DO")} mensajes de visitantes</p>
        )}
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-navy-50" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.exhausted ? 0 : s.percentLeft} aria-label="Tokens restantes del asistente">
        <div className={`h-full ${tone}`} style={{ width: `${s.exhausted ? 0 : s.percentLeft}%` }} />
      </div>
      {s.exhausted && <p className="mt-2 text-sm font-medium text-red-700">Tokens agotados: el asistente muestra solo los datos de contacto directo hasta la próxima recarga.</p>}
    </div>
  );
}
