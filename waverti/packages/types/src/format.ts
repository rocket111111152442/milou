/** Formatage fr-FR partagé (prix, durées, dates relatives). */
const priceFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatPrice(value: number | null | undefined, currency = "EUR"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (currency === "EUR") return priceFmt.format(value);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value);
}

export function formatCents(cents: number): string {
  return priceFmt.format(cents / 100);
}

export function formatInterval(minutes: number): string {
  if (minutes < 60) return `toutes les ${minutes} min`;
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    return d === 1 ? "une fois par jour" : `tous les ${d} jours`;
  }
  if (minutes === 720) return "deux fois par jour";
  if (minutes % 60 === 0) return `toutes les ${minutes / 60} h`;
  return `toutes les ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (m < 60) return rest ? `${m} min ${rest} s` : `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} j ${h % 24} h`;
}

const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "jamais";
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return diff >= 0 ? "dans quelques secondes" : "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

const dtFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export function formatDateTime(iso: string | Date | null | undefined, timeZone = "Europe/Paris"): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (timeZone === "Europe/Paris") return dtFmt.format(d);
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone }).format(d);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "Donnée indisponible";
  return `${(value * 100).toFixed(digits).replace(".", ",")} %`;
}
