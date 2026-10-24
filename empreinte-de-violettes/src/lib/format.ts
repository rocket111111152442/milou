export const euro = (cents: number, opts: { compact?: boolean } = {}) => {
  const v = cents / 100;
  const whole = Number.isInteger(v);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts.compact && whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
};

export const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « mardi 4 novembre » à partir de AAAA-MM-JJ */
export function frDate(iso: string, withYear = false) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = DAYS[dt.getUTCDay()].toLowerCase();
  return `${day} ${d}${d === 1 ? "er" : ""} ${MONTHS[m - 1]}${withYear ? " " + y : ""}`;
}

export function frDateTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function hhmm(t: string) {
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: "En attente de paiement", tone: "bg-amber-100 text-amber-800" },
  paid: { label: "Nouvelle · confirmée", tone: "bg-violet-100 text-violet-800" },
  preparing: { label: "En préparation", tone: "bg-sky-100 text-sky-800" },
  ready: { label: "Prête", tone: "bg-teal-100 text-teal-800" },
  out_for_delivery: { label: "En livraison", tone: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "Livrée", tone: "bg-emerald-100 text-emerald-800" },
  picked_up: { label: "Retirée", tone: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Annulée", tone: "bg-neutral-200 text-neutral-700" },
  refunded: { label: "Remboursée", tone: "bg-rose-100 text-rose-800" },
};

export const MODE_LABEL: Record<string, string> = {
  delivery: "Livraison",
  pickup: "Retrait en boutique",
  drive: "Drive",
};

/** Regroupe les jours consécutifs aux horaires identiques : « Du mardi au samedi — 9 h – 12 h 30, 15 h – 19 h 30 ». */
export function groupHours(hours: { day: number; closed: boolean; ranges: { from: string; to: string }[] }[]) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const key = (d: number) => {
    const h = hours.find((x) => x.day === d);
    return !h || h.closed ? "closed" : h.ranges.map((r) => `${r.from}-${r.to}`).join("|");
  };
  const groups: { days: number[]; key: string }[] = [];
  for (const d of order) {
    const k = key(d);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.days.push(d);
    else groups.push({ days: [d], key: k });
  }
  const name = (d: number) => DAYS[d].toLowerCase();
  return groups.map((g) => {
    const h = hours.find((x) => x.day === g.days[0]);
    const label =
      g.days.length === 1 ? DAYS[g.days[0]] : g.days.length === 2 ? `${DAYS[g.days[0]]} et ${name(g.days[1])}` : `Du ${name(g.days[0])} au ${name(g.days[g.days.length - 1])}`;
    return { label, closed: g.key === "closed", lines: g.key === "closed" || !h ? [] : h.ranges.map((r) => `${hhmm(r.from)} – ${hhmm(r.to)}`) };
  });
}
