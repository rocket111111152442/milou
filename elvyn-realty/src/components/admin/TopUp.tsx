"use client";
import { useState } from "react";

export function TopUp({ packs, currency, min, max, enabled }: { packs: number[]; currency: string; min: number; max: number; enabled: boolean }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const symbol = currency === "eur" ? "€" : currency === "usd" ? "US$" : currency.toUpperCase();
  const fmt = (n: number) => (currency === "eur" ? `${n} €` : `${symbol}${n}`);

  async function pay(amount: number) {
    setError(null);
    setBusy(amount);
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { url?: string; error?: string }) : {};
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setBusy(null);
    setError(data.error === "invalid_amount" ? `Importe entre ${fmt(min)} y ${fmt(max)}.` : data.error === "payments_not_configured" ? "Los pagos aún no están configurados." : "No se pudo abrir la página de pago. Inténtalo de nuevo.");
  }

  if (!enabled) return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Los pagos en línea aún no están activados. Contacta con tu proveedor del sitio para recargar tokens.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {packs.map((p) => (
          <button key={p} type="button" onClick={() => pay(p)} disabled={busy !== null} className="btn-primary min-w-[120px]">
            {busy === p ? "Abriendo…" : `Recargar ${fmt(p)}`}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Math.round(Number(custom));
          if (n) pay(n);
        }}
      >
        <div>
          <label className="field-label" htmlFor="custom-amount">Otro importe ({symbol})</label>
          <input id="custom-amount" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ""))} className="field w-36" placeholder={String(min)} />
        </div>
        <button className="btn-outline" disabled={busy !== null || !custom}>Recargar</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-ink-soft">Pago seguro con Stripe. Los tokens se añaden automáticamente en cuanto se confirma el pago.</p>
    </div>
  );
}
