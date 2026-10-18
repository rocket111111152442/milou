"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useLenis } from "lenis/react";
import { cartDetails, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";
import {
  formatDateLong,
  formatTime,
  leadMinutesFor,
  parisNow,
  addDays,
  pickupDays,
  rangesFor,
  slotsFor,
  toMinutes,
} from "@/lib/hours";
import { orderSchema, type OrderResponse } from "@/lib/order";
import Image from "next/image";
import { SHOPS, getShop, shopLinks, type Shop, type ShopId } from "@/lib/shops";
import { ProductThumb } from "@/components/menu/ProductImage";
import { QtyStepper } from "@/components/cart/QtyStepper";
import { Confetti } from "./Confetti";

const STEPS = ["Panier", "Retrait", "Coordonnées"] as const;
const ease = [0.22, 1, 0.36, 1] as const;

type Customer = { firstName: string; lastName: string; phone: string; email: string; note: string };
type Done = { orderNumber: string; total: number; demo: boolean; shop: ShopId; date: string; time: string; items: { name: string; qty: number }[]; firstName: string };

function shortDay(date: string, today: string) {
  if (date === today) return "Aujourd'hui";
  if (date === addDays(today, 1)) return "Demain";
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function dayNumber(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return {
    day: d,
    month: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d))),
  };
}

/** Vrai si la boutique ferme avant 14 h ce jour-là (ex. dimanche matin). */
function morningOnly(shop: Shop, date: string) {
  const r = rangesFor(shop, date);
  return r.length > 0 && toMinutes(r[r.length - 1][1]) <= 14 * 60;
}

function icsFile(done: Done, shop: Shop) {
  const [y, m, d] = done.date.split("-");
  const [hh, mm] = done.time.split(":");
  const start = `${y}${m}${d}T${hh}${mm}00`;
  const endMin = Number(hh) * 60 + Number(mm) + 15;
  const end = `${y}${m}${d}T${String(Math.floor(endMin / 60)).padStart(2, "0")}${String(endMin % 60).padStart(2, "0")}00`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Le Petrin de Pepiole//Commande//FR",
    "BEGIN:VEVENT",
    `UID:${done.orderNumber}@petrin-de-pepiole`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;TZID=Europe/Paris:${start}`,
    `DTEND;TZID=Europe/Paris:${end}`,
    `SUMMARY:Retrait commande ${done.orderNumber} – ${shop.name}`,
    `LOCATION:${shop.name}\\, ${shop.address.street}\\, ${shop.address.postalCode} ${shop.address.city}`,
    `DESCRIPTION:${done.items.map((i) => `${i.qty} × ${i.name}`).join("\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
}

export function Checkout({ enabledShops }: { enabledShops: ShopId[] }) {
  const [hydrated, setHydrated] = useState(false);
  const { lines, setQty, remove, clear, shop: shopId, setShop } = useCart();
  const shop = shopId ? getShop(shopId) : null;
  const demo = shopId ? !enabledShops.includes(shopId) : enabledShops.length < SHOPS.length;
  const { items, total, count, leadHours } = cartDetails(lines);
  const lead = leadMinutesFor(leadHours);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer>({ firstName: "", lastName: "", phone: "", email: "", note: "" });
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const lenis = useLenis();
  const toTop = () => (lenis ? lenis.scrollTo(0, { duration: 0.8 }) : window.scrollTo({ top: 0, behavior: "smooth" }));

  useEffect(() => {
    setHydrated(true);
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = parisNow(now).date;
  const days = useMemo(() => (shop ? pickupDays(shop, lead, now) : []), [shop, lead, now]);
  const slots = useMemo(() => (shop && date ? slotsFor(shop, date, lead, now) : []), [shop, date, lead, now]);

  // Choisit automatiquement le premier jour disponible, et invalide un créneau devenu impossible
  useEffect(() => {
    if (!hydrated) return;
    if (!date || !days.find((d) => d.date === date)?.hasSlots) {
      setDate(days.find((d) => d.hasSlots)?.date ?? null);
      setTime(null);
    }
  }, [days, date, hydrated]);
  useEffect(() => {
    if (time && !slots.find((s) => s.time === time && s.available)) setTime(null);
  }, [slots, time]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    toTop();
  };

  const submit = async () => {
    setServerError(null);
    const payload = {
      items: lines.map((l) => ({ id: l.id, qty: l.qty })),
      pickup: { shop: shopId ?? "", date: date ?? "", time: time ?? "" },
      customer,
      consent,
      website,
    };
    const parsed = orderSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      if (errs["pickup.shop"] || errs["pickup.date"] || errs["pickup.time"]) go(1);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as OrderResponse;
      if (!data.ok) {
        setServerError(data.error);
        return;
      }
      setDone({
        orderNumber: data.orderNumber,
        total: data.total,
        demo: data.demo,
        shop: shopId!,
        date: date!,
        time: time!,
        items: items.map((i) => ({ name: i.product.name, qty: i.qty })),
        firstName: customer.firstName,
      });
      clear();
      toTop();
    } catch {
      setServerError(`Connexion impossible. Réessayez ou appelez la boutique${shop ? ` au ${shop.phone.display}` : ""}.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hydrated) {
    return <div className="h-[60vh] animate-pulse rounded-[2rem] bg-mie/40" />;
  }

  if (done) return <Confirmation done={done} />;

  if (items.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl py-16 text-center">
        <motion.p className="text-7xl" animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}>
          🥖
        </motion.p>
        <h1 className="mt-6 font-display text-5xl tracking-tight">Votre panier est vide</h1>
        <p className="mt-4 text-cafe/70">Faites un tour à la carte : tout se commande en quelques clics, et se récupère en boutique.</p>
        <Link href="/carte" className="mt-8 inline-flex h-14 items-center rounded-full bg-croute px-8 font-semibold text-creme transition hover:bg-cafe">
          Découvrir la carte →
        </Link>
      </motion.div>
    );
  }

  const field = (key: keyof Customer, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`f-${key}`} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        {...props}
        id={`f-${key}`}
        value={customer[key]}
        onChange={(e) => setCustomer((c) => ({ ...c, [key]: e.target.value }))}
        aria-invalid={Boolean(errors[`customer.${key}`])}
        aria-describedby={errors[`customer.${key}`] ? `e-${key}` : undefined}
        className={`h-12 w-full rounded-2xl border bg-creme px-4 outline-none transition focus:ring-4 ${
          errors[`customer.${key}`] ? "border-red-400 focus:ring-red-100" : "border-mie focus:border-croute focus:ring-croute/10"
        }`}
      />
      <AnimatePresence>
        {errors[`customer.${key}`] && (
          <motion.span id={`e-${key}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 block text-sm text-red-600">
            {errors[`customer.${key}`]}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );

  const morning = slots.filter((s) => s.time < "12:00");
  const noon = slots.filter((s) => s.time >= "12:00" && s.time < "14:00");
  const afternoon = slots.filter((s) => s.time >= "14:00");

  return (
    <div>
      {demo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-start gap-3 rounded-2xl border border-caramel/40 bg-dore/15 px-5 py-4 text-sm"
          role="note"
        >
          <span aria-hidden="true">ℹ️</span>
          <p>
            <strong>Commande en ligne en cours de mise en place.</strong> Vous pouvez tester le parcours, mais la commande ne
            sera pas encore transmise à la boutique. Pour commander dès maintenant, appelez{" "}
            {(shop ? [shop] : SHOPS).map((s, i, arr) => (
              <span key={s.id}>
                {i > 0 && (i === arr.length - 1 ? " ou " : ", ")}
                {arr.length > 1 && `${s.short} : `}
                <a href={s.phone.href} className="font-semibold underline">
                  {s.phone.display}
                </a>
              </span>
            ))}
            .
          </p>
        </motion.div>
      )}

      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-script text-3xl text-caramel">Click &amp; collect</p>
          <h1 className="font-display text-5xl tracking-tight sm:text-6xl">Ma commande</h1>
        </div>
        <ol className="flex items-center gap-2" aria-label="Étapes">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <button
                type="button"
                disabled={i > step}
                onClick={() => i < step && go(i)}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${i === step ? "bg-cafe text-creme" : i < step ? "bg-mie text-cafe hover:bg-sable" : "text-grege"}`}
                aria-current={i === step ? "step" : undefined}
              >
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i === step ? "bg-dore text-torref" : i < step ? "bg-olive text-creme" : "border border-grege/40"}`}>
                  {i < step ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-4 bg-sable sm:w-8" />}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="relative lg:col-span-8">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -60 }}
              transition={{ duration: 0.45, ease }}
              className="rounded-[2rem] bg-creme p-6 ring-1 ring-mie sm:p-9"
            >
              {step === 0 && (
                <div>
                  <h2 className="mb-6 font-display text-3xl">Votre panier</h2>
                  <ul className="divide-y divide-mie">
                    <AnimatePresence initial={false}>
                      {items.map(({ product, qty, total: t }) => (
                        <motion.li key={product.id} layout exit={{ opacity: 0, height: 0 }} className="flex items-center gap-4 py-4">
                          <ProductThumb product={product} className="h-16 w-16 shrink-0 rounded-xl sm:h-20 sm:w-20" sizes="80px" />
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-lg leading-tight">{product.name}</p>
                            <p className="text-xs text-grege">
                              {formatPrice(product.price)}
                              {product.unit ? ` · ${product.unit}` : ""}
                              {product.leadHours ? ` · à commander ${product.leadHours} h avant` : ""}
                            </p>
                            <button type="button" onClick={() => remove(product.id)} className="mt-1 text-xs font-semibold text-croute hover:underline">
                              Retirer
                            </button>
                          </div>
                          <QtyStepper value={qty} onChange={(v) => setQty(product.id, v)} label={product.name} small />
                          <span className="hidden w-20 text-right font-semibold sm:block">{formatPrice(t)}</span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Link href="/carte" className="inline-flex h-12 items-center justify-center rounded-full border border-mie px-6 font-semibold transition hover:bg-mie">
                      ← Continuer mes achats
                    </Link>
                    <button type="button" onClick={() => go(1)} className="inline-flex h-12 items-center justify-center rounded-full bg-croute px-8 font-semibold text-creme transition hover:bg-cafe">
                      Choisir le retrait →
                    </button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="font-display text-3xl">Où passez-vous ?</h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Boutique de retrait">
                    {SHOPS.map((s) => {
                      const on = s.id === shopId;
                      return (
                        <motion.button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            if (s.id === shopId) return;
                            setShop(s.id);
                            setDate(null);
                            setTime(null);
                          }}
                          className={`group relative overflow-hidden rounded-2xl text-left ring-2 transition ${on ? "ring-croute" : "ring-transparent hover:ring-sable"}`}
                        >
                          <div className="relative aspect-[16/6] overflow-hidden bg-mie">
                            <Image src={s.image} alt="" fill sizes="(min-width:640px) 30vw, 90vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                            <div className={`absolute inset-0 transition ${on ? "bg-torref/10" : "bg-torref/35"}`} />
                            <AnimatePresence>
                              {on && (
                                <motion.span
                                  initial={{ scale: 0, rotate: -45 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  exit={{ scale: 0 }}
                                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-croute text-sm font-bold text-creme shadow-lg"
                                >
                                  ✓
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className={`p-4 transition-colors ${on ? "bg-cafe text-creme" : "bg-farine"}`}>
                            <p className="font-display text-xl leading-tight">{s.name}</p>
                            <p className={`text-xs ${on ? "text-creme/70" : "text-grege"}`}>
                              {s.address.street}, {s.address.city}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                  {errors["pickup.shop"] && <p className="mt-3 text-sm text-red-600">Choisissez la boutique de retrait.</p>}

                  {shop && (
                  <motion.div key={shop.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
                  <h3 className="mt-9 font-display text-2xl">Quand passez-vous ?</h3>
                  <p className="mt-2 text-sm text-cafe/70">
                    {lead > 120
                      ? `Votre panier contient des produits préparés sur commande : premier retrait possible dans ${Math.round(lead / 60)} h.`
                      : "Retrait possible à partir de 2 h après votre commande, pendant les horaires d'ouverture."}
                  </p>

                  <div className="scrollbar-none -mx-2 mt-6 flex gap-2 overflow-x-auto px-2 pb-2" data-lenis-prevent>
                    {days.map((d) => {
                      const active = d.date === date;
                      const { day, month } = dayNumber(d.date);
                      return (
                        <button
                          key={d.date}
                          type="button"
                          disabled={!d.hasSlots}
                          onClick={() => {
                            setDate(d.date);
                            setTime(null);
                          }}
                          className={`relative flex w-[78px] shrink-0 flex-col items-center rounded-2xl px-2 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "text-creme" : "bg-farine hover:bg-mie"}`}
                          aria-pressed={active}
                        >
                          {active && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-cafe" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                          <span className="relative text-[11px] font-bold uppercase tracking-wide opacity-70">{shortDay(d.date, today)}</span>
                          <span className="relative font-display text-2xl leading-tight">{day}</span>
                          <span className="relative text-xs opacity-70">{month}</span>
                          {morningOnly(shop, d.date) && <span className="relative mt-0.5 text-[10px] opacity-60">matin</span>}
                        </button>
                      );
                    })}
                  </div>

                  {date && (
                    <motion.div key={date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-6">
                      {[
                        { label: "Matin", list: morning },
                        { label: "Midi", list: noon },
                        { label: "Après-midi", list: afternoon },
                      ]
                        .filter((g) => g.list.length > 0)
                        .map((g) => (
                          <div key={g.label}>
                            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-grege">{g.label}</p>
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                              {g.list.map((s, i) => (
                                <motion.button
                                  key={s.time}
                                  type="button"
                                  disabled={!s.available}
                                  onClick={() => setTime(s.time)}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: Math.min(i, 20) * 0.015 }}
                                  whileTap={{ scale: 0.92 }}
                                  className={`h-11 rounded-xl text-sm font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:line-through disabled:opacity-30 ${
                                    time === s.time ? "bg-croute text-creme shadow-lg" : "bg-farine hover:bg-mie"
                                  }`}
                                  aria-pressed={time === s.time}
                                >
                                  {formatTime(s.time)}
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </motion.div>
                  )}
                  {errors["pickup.time"] && <p className="mt-3 text-sm text-red-600">Choisissez un créneau de retrait.</p>}
                  </motion.div>
                  )}

                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <button type="button" onClick={() => go(0)} className="inline-flex h-12 items-center justify-center rounded-full border border-mie px-6 font-semibold transition hover:bg-mie">
                      ← Panier
                    </button>
                    <button
                      type="button"
                      disabled={!shop || !date || !time}
                      onClick={() => go(2)}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-croute px-8 font-semibold text-creme transition hover:bg-cafe disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Mes coordonnées →
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  noValidate
                >
                  <h2 className="mb-6 font-display text-3xl">À quel nom ?</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field("firstName", "Prénom *", { autoComplete: "given-name", required: true })}
                    {field("lastName", "Nom *", { autoComplete: "family-name", required: true })}
                    {field("phone", "Téléphone *", { autoComplete: "tel", type: "tel", inputMode: "tel", placeholder: "06 12 34 56 78", required: true })}
                    {field("email", "E-mail (pour recevoir la confirmation)", { autoComplete: "email", type: "email", inputMode: "email" })}
                  </div>
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-sm font-semibold">Une précision ?</span>
                    <textarea
                      value={customer.note}
                      onChange={(e) => setCustomer((c) => ({ ...c, note: e.target.value }))}
                      maxLength={500}
                      rows={3}
                      placeholder="Baguette bien cuite, message sur le gâteau, viennoiserie de la formule…"
                      className="w-full rounded-2xl border border-mie bg-creme px-4 py-3 outline-none transition focus:border-croute focus:ring-4 focus:ring-croute/10"
                    />
                  </label>
                  {/* Champ piège pour les robots */}
                  <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                  <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-croute" />
                    <span className={errors["consent"] ? "text-red-600" : "text-cafe/80"}>
                      J&apos;accepte que mes coordonnées soient utilisées uniquement pour traiter cette commande.{" "}
                      <Link href="/mentions-legales#donnees" className="underline">
                        En savoir plus
                      </Link>
                    </span>
                  </label>

                  <AnimatePresence>
                    {serverError && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                        {serverError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <button type="button" onClick={() => go(1)} className="inline-flex h-12 items-center justify-center rounded-full border border-mie px-6 font-semibold transition hover:bg-mie">
                      ← Créneau
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full bg-croute px-8 font-semibold text-creme transition hover:bg-cafe disabled:opacity-70"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-3">
                          <motion.span className="h-4 w-4 rounded-full border-2 border-creme/30 border-t-creme" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
                          Envoi au fournil…
                        </span>
                      ) : (
                        `Valider ma commande · ${formatPrice(total)}`
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Récapitulatif */}
        <aside className="lg:col-span-4">
          <div className="sticky top-28 rounded-[2rem] bg-cafe p-7 text-creme">
            <p className="font-script text-2xl text-dore">Récapitulatif</p>
            <ul className="mt-4 space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.product.id} className="flex justify-between gap-3">
                  <span className="text-creme/80">
                    {i.qty} × {i.product.name}
                  </span>
                  <span className="tabular-nums">{formatPrice(i.total)}</span>
                </li>
              ))}
            </ul>
            <div className="my-5 h-px bg-creme/15" />
            <div className="flex items-baseline justify-between">
              <span className="text-creme/60">
                {count} article{count > 1 ? "s" : ""}
              </span>
              <motion.span key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-display text-4xl">
                {formatPrice(total)}
              </motion.span>
            </div>
            <AnimatePresence>
              {shop && date && time && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-5 rounded-2xl bg-creme/10 p-4 text-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-creme/50">Retrait · {shop.name}</p>
                    <p className="mt-1 font-display text-xl first-letter:uppercase">
                      {formatDateLong(date)} à {formatTime(time)}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="mt-5 text-xs leading-relaxed text-creme/60">
              Paiement en boutique au moment du retrait
              {shop ? ` · ${shop.name}, ${shop.address.street}, ${shop.address.city}` : ""}.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Confirmation({ done }: { done: Done }) {
  const shop = getShop(done.shop);
  const [ics, setIcs] = useState<string | null>(null);
  useEffect(() => {
    const url = icsFile(done, getShop(done.shop));
    setIcs(url);
    return () => URL.revokeObjectURL(url);
  }, [done]);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="mx-auto max-w-2xl text-center">
      <Confetti />
      <motion.div
        className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-olive text-5xl text-creme shadow-xl"
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
      >
        ✓
      </motion.div>
      <p className="mt-8 font-script text-4xl text-caramel">Merci {done.firstName} !</p>
      <h1 className="mt-1 font-display text-5xl tracking-tight sm:text-6xl">{done.demo ? "Commande de test enregistrée" : "Commande envoyée au fournil"}</h1>

      {done.demo ? (
        <p className="mx-auto mt-5 max-w-lg rounded-2xl bg-dore/20 px-5 py-4 text-sm">
          La commande en ligne est en cours de mise en place : <strong>cette commande n&apos;a pas été transmise à la boutique</strong>.
          Pour commander pour de vrai, appelez le{" "}
          <a href={shop.phone.href} className="font-semibold underline">
            {shop.phone.display}
          </a>
          .
        </p>
      ) : (
        <p className="mx-auto mt-5 max-w-lg text-cafe/75">
          Elle vous attendra chez {shop.name}, {shop.address.street} à {shop.address.city}. Le règlement se fait sur place, au moment du retrait.
        </p>
      )}

      <div className="mt-10 rounded-[2rem] bg-creme p-7 text-left ring-1 ring-mie">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-grege">N° de commande</p>
            <p className="font-display text-3xl">{done.orderNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-grege">Retrait · {shop.name}</p>
            <p className="font-display text-xl first-letter:uppercase">
              {formatDateLong(done.date)} · {formatTime(done.time)}
            </p>
          </div>
        </div>
        <ul className="mt-5 space-y-1 border-t border-mie pt-5 text-sm">
          {done.items.map((i) => (
            <li key={i.name}>
              {i.qty} × {i.name}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-right font-display text-2xl">{formatPrice(done.total)}</p>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {ics && (
          <a href={ics} download={`retrait-${done.orderNumber}.ics`} className="inline-flex h-12 items-center justify-center rounded-full border border-mie bg-creme px-6 font-semibold transition hover:bg-mie">
            📅 Ajouter à mon agenda
          </a>
        )}
        <a href={shopLinks(shop).directionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center rounded-full border border-mie bg-creme px-6 font-semibold transition hover:bg-mie">
          Itinéraire
        </a>
        <Link href="/" className="inline-flex h-12 items-center justify-center rounded-full bg-cafe px-6 font-semibold text-creme transition hover:bg-croute">
          Retour à l&apos;accueil
        </Link>
      </div>
    </motion.div>
  );
}
