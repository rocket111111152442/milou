"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Car, Check, Loader2, Lock, Store, Tag, Truck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { VioletMark } from "@/components/site/Logo";
import { SmartImage } from "@/components/site/SmartImage";
import { cn } from "@/lib/cn";
import type { DayAvailability } from "@/lib/delivery";
import { DAYS_SHORT, euro, frDate, MONTHS } from "@/lib/format";
import type { FulfillmentMode } from "@/lib/types";
import { cartCount, toServerLines, useCart } from "@/store/cart";

type Quote = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  zone: { name: string; freeFrom: number | null; minOrder: number } | null;
  promo: { code: string; description?: string } | null;
  errors: string[];
  warnings: string[];
};

export interface CheckoutConfig {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  driveEnabled: boolean;
  pickupNote: string;
  driveNote: string;
  allowPayInStore: boolean;
  stripeEnabled: boolean;
  shopAddress: string;
}

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: n * 0.06 }}
      className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.03] p-6 sm:p-8"
    >
      <div className="mb-6 flex items-center gap-4">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full border font-caps text-xs transition", done ? "border-gold bg-gold text-noir" : "border-ivory/25 text-ivory/70")}>
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <h2 className="font-display text-3xl">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={cn("block", className)}>
    <span className="label text-ivory">{label}</span>
    {children}
  </label>
);

export function Checkout({ config, cancelled }: { config: CheckoutConfig; cancelled: boolean }) {
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const modes = useMemo(
    () =>
      (
        [
          { id: "delivery", label: "Livraison", sub: "À domicile, au bureau, au funérarium", icon: Truck, on: config.deliveryEnabled },
          { id: "pickup", label: "Retrait en boutique", sub: "Gratuit", icon: Store, on: config.pickupEnabled },
          { id: "drive", label: "Drive", sub: "On vous l'apporte à la voiture", icon: Car, on: config.driveEnabled },
        ] as const
      ).filter((m) => m.on),
    [config],
  );
  const [mode, setMode] = useState<FulfillmentMode>(modes[0]?.id || "pickup");
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [recipient, setRecipient] = useState({ name: "", phone: "", company: "", address: "", address2: "", postcode: "", city: "", instructions: "" });
  const [sameAsMe, setSameAsMe] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [cardSignature, setCardSignature] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [payInStore, setPayInStore] = useState(false);
  const [terms, setTerms] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const daysRef = useRef<HTMLDivElement>(null);

  // créneaux disponibles
  useEffect(() => {
    let alive = true;
    setDays(null);
    fetch(`/api/delivery/availability?mode=${mode}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setDays(d.days);
        const first = (d.days as DayAvailability[]).find((x) => x.open);
        setDate((cur) => ((d.days as DayAvailability[]).some((x) => x.date === cur && x.open) ? cur : first?.date || ""));
      });
    return () => {
      alive = false;
    };
  }, [mode]);

  const day = days?.find((d) => d.date === date);
  useEffect(() => {
    if (!day) return;
    if (!day.slots.some((s) => s.id === slotId && s.available)) setSlotId(day.slots.find((s) => s.available)?.id || "");
  }, [day, slotId]);

  // devis serveur (prix, livraison, remise)
  const serverLines = useMemo(() => toServerLines(lines), [lines]);
  useEffect(() => {
    if (!mounted || !lines.length) return;
    const pc = /^\d{5}$/.test(recipient.postcode) ? recipient.postcode : undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch("/api/cart/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: serverLines, mode, postcode: pc, city: recipient.city || undefined, promoCode: promoCode || undefined }),
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then(setQuote)
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [mounted, serverLines, lines.length, mode, recipient.postcode, recipient.city, promoCode]);

  useEffect(() => {
    if (sameAsMe) setRecipient((r) => ({ ...r, name: `${customer.firstName} ${customer.lastName}`.trim(), phone: customer.phone }));
  }, [sameAsMe, customer.firstName, customer.lastName, customer.phone]);

  if (!mounted) return <div className="min-h-[60vh]" />;

  if (!lines.length)
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <VioletMark className="h-16 w-16 text-gold/70" strokeWidth={1} />
        <p className="mt-6 font-display text-4xl italic">Votre panier est vide</p>
        <Link href="/boutique" className="btn btn-ivory mt-8">
          <span>Découvrir la boutique</span>
        </Link>
      </div>
    );

  const needsAddress = mode === "delivery";
  const quoteError = quote?.errors?.[0];
  const canPayInStore = config.allowPayInStore && mode !== "delivery";
  const deliveryPostcodeIssue = needsAddress && /^\d{5}$/.test(recipient.postcode) && quoteError;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!date || !slotId) return setError("Choisissez une date et un créneau.");
    if (!terms) return setError("Veuillez accepter les conditions générales de vente.");
    setSubmitting(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: serverLines,
        mode,
        date,
        slotId,
        customer,
        recipient: needsAddress ? recipient : undefined,
        cardMessage: cardMessage || undefined,
        cardSignature: cardSignature || undefined,
        anonymous,
        promoCode: promoCode || undefined,
        payInStore: canPayInStore && payInStore,
        acceptTerms: terms,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setSubmitting(false);
      setError(data.error || "Une erreur est survenue. Réessayez.");
      return;
    }
    // copie locale de secours (stockage mémoire sans base de données : la page de confirmation peut tomber sur une autre instance)
    if (data.order) {
      try {
        sessionStorage.setItem("ev-last-order", JSON.stringify(data.order));
      } catch {}
    }
    window.location.href = data.url;
  }

  const months = days ? Array.from(new Set(days.map((d) => Number(d.date.slice(5, 7)) - 1))) : [];

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-[1500px] gap-10 px-6 pb-32 sm:px-10 lg:grid-cols-[1.4fr_1fr] lg:px-16">
      <div className="min-w-0 space-y-6">
        {cancelled && (
          <div className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm text-gold-light">
            <AlertTriangle className="h-4 w-4" /> Le paiement a été annulé. Votre panier est intact : vous pouvez réessayer.
          </div>
        )}
        {!config.stripeEnabled && (
          <div className="flex items-start gap-3 rounded-2xl border border-aubergine-400/30 bg-aubergine-800/40 p-4 text-sm text-aubergine-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Mode démonstration</strong> — le paiement Stripe n&apos;est pas encore activé : la commande sera enregistrée sans paiement réel.
            </span>
          </div>
        )}

        <Step n={1} title="Comment recevoir vos fleurs ?" done={!!mode}>
          <div className="grid gap-3 sm:grid-cols-3">
            {modes.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn("relative overflow-hidden rounded-2xl border p-5 text-left transition", mode === m.id ? "border-gold" : "border-ivory/15 hover:border-ivory/35")}
                aria-pressed={mode === m.id}
              >
                {mode === m.id && <motion.span layoutId="mode-bg" className="absolute inset-0 bg-gradient-to-br from-gold/15 to-transparent" />}
                <m.icon className={cn("relative h-6 w-6", mode === m.id ? "text-gold" : "text-ivory/60")} strokeWidth={1.3} />
                <span className="relative mt-4 block font-display text-xl">{m.label}</span>
                <span className="relative mt-1 block text-xs text-ivory/50">{m.sub}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            {mode !== "delivery" && (
              <motion.p key={mode} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-sm text-ivory/60">
                {mode === "pickup" ? config.pickupNote : config.driveNote}
              </motion.p>
            )}
          </AnimatePresence>
        </Step>

        <Step n={2} title="Quand ?" done={!!date && !!slotId}>
          {!days ? (
            <div className="flex items-center gap-3 text-sm text-ivory/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des créneaux…
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-ivory/45">{months.map((m) => MONTHS[m]).join(" · ")}</p>
              <div ref={daysRef} className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-3 no-scrollbar" data-lenis-prevent>
                {days.map((d) => {
                  const on = d.date === date;
                  return (
                    <button
                      type="button"
                      key={d.date}
                      disabled={!d.open}
                      onClick={() => setDate(d.date)}
                      title={d.reason}
                      className={cn(
                        "relative flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition",
                        on ? "border-gold text-noir" : d.open ? "border-ivory/15 hover:border-ivory/40" : "cursor-not-allowed border-ivory/5 text-ivory/25",
                      )}
                    >
                      {on && <motion.span layoutId="day-bg" className="bg-foil absolute inset-0 rounded-2xl" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                      <span className="relative text-[0.6rem] uppercase tracking-[0.14em]">{DAYS_SHORT[d.weekday]}</span>
                      <span className="relative font-display text-2xl leading-tight">{Number(d.date.slice(8))}</span>
                      <span className="relative text-[0.55rem] uppercase opacity-60">{MONTHS[Number(d.date.slice(5, 7)) - 1].slice(0, 4)}</span>
                    </button>
                  );
                })}
              </div>
              {day && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {day.slots.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      disabled={!s.available}
                      onClick={() => setSlotId(s.id)}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition",
                        slotId === s.id ? "border-gold bg-gold/10" : s.available ? "border-ivory/15 hover:border-ivory/35" : "cursor-not-allowed border-ivory/5 text-ivory/30",
                      )}
                    >
                      <span>{s.label}</span>
                      <span className="text-xs text-ivory/50">{s.available ? (slotId === s.id ? "✦ Choisi" : "") : s.reason}</span>
                    </button>
                  ))}
                </div>
              )}
              {date && <p className="mt-4 text-sm text-gold-light">✦ {frDate(date)}</p>}
            </>
          )}
        </Step>

        {needsAddress && (
          <Step n={3} title="À qui livrons-nous ?" done={!!recipient.address && !!recipient.postcode && !deliveryPostcodeIssue}>
            <label className="mb-5 flex items-center gap-3 text-sm text-ivory/70">
              <input type="checkbox" checked={sameAsMe} onChange={(e) => setSameAsMe(e.target.checked)} className="h-4 w-4 accent-[#C6A15B]" />
              C&apos;est pour moi
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du destinataire *">
                <input required className="field-box" value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} autoComplete="shipping name" />
              </Field>
              <Field label="Téléphone du destinataire *">
                <input required className="field-box" type="tel" value={recipient.phone} onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })} />
              </Field>
              <Field label="Adresse *" className="sm:col-span-2">
                <input required className="field-box" value={recipient.address} onChange={(e) => setRecipient({ ...recipient, address: e.target.value })} autoComplete="shipping address-line1" placeholder="N° et rue" />
              </Field>
              <Field label="Complément (bâtiment, étage, funérarium…)" className="sm:col-span-2">
                <input className="field-box" value={recipient.address2} onChange={(e) => setRecipient({ ...recipient, address2: e.target.value })} autoComplete="shipping address-line2" />
              </Field>
              <Field label="Code postal *">
                <input
                  required
                  inputMode="numeric"
                  maxLength={5}
                  className={cn("field-box", deliveryPostcodeIssue && "!border-rose-400/70")}
                  value={recipient.postcode}
                  onChange={(e) => setRecipient({ ...recipient, postcode: e.target.value.replace(/\D/g, "") })}
                  autoComplete="shipping postal-code"
                />
              </Field>
              <Field label="Ville *">
                <input required className="field-box" value={recipient.city} onChange={(e) => setRecipient({ ...recipient, city: e.target.value })} autoComplete="shipping address-level2" />
              </Field>
              <Field label="Entreprise (facultatif)">
                <input className="field-box" value={recipient.company} onChange={(e) => setRecipient({ ...recipient, company: e.target.value })} />
              </Field>
              <Field label="Instructions de livraison">
                <input className="field-box" value={recipient.instructions} onChange={(e) => setRecipient({ ...recipient, instructions: e.target.value })} placeholder="Digicode, heure de cérémonie…" />
              </Field>
            </div>
            <AnimatePresence>
              {/^\d{5}$/.test(recipient.postcode) && quote && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={cn("mt-4 text-sm", quoteError ? "text-rose-300" : "text-gold-light")}>
                  {quoteError ? quoteError : quote.zone ? `✦ ${quote.zone.name} — livraison ${quote.deliveryFee ? euro(quote.deliveryFee) : "offerte"}` : null}
                </motion.p>
              )}
            </AnimatePresence>
          </Step>
        )}

        <Step n={needsAddress ? 4 : 3} title="Un mot sur la carte ?" done={!!cardMessage}>
          <div className="grid gap-6 md:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <Field label="Votre message (écrit à la main)">
                <textarea className="field-box min-h-[120px] resize-none" maxLength={400} value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} placeholder="Joyeux anniversaire, ma douce…" />
              </Field>
              <Field label="Signature">
                <input className="field-box" maxLength={80} value={cardSignature} onChange={(e) => setCardSignature(e.target.value)} placeholder="Avec tout mon amour, Julien" disabled={anonymous} />
              </Field>
              <label className="flex items-center gap-3 text-sm text-ivory/70">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-[#C6A15B]" />
                Envoi anonyme
              </label>
            </div>
            <motion.div className="relative flex min-h-[220px] items-center justify-center rounded-xl bg-[#F3EADF] p-6 text-noir shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]" initial={{ rotate: -2 }} animate={{ rotate: cardMessage ? 1 : -2 }}>
              <div className="fern-paper absolute inset-0 rounded-xl" />
              <div className="absolute inset-3 rounded-lg border border-aubergine-700/20" />
              <div className="relative text-center">
                <VioletMark className="mx-auto h-7 w-7 text-aubergine-600" />
                <p className="mt-3 whitespace-pre-wrap font-display text-xl italic leading-snug">{cardMessage || "Votre message apparaîtra ici…"}</p>
                {!anonymous && cardSignature && <p className="mt-3 font-display text-lg text-aubergine-700">— {cardSignature}</p>}
              </div>
            </motion.div>
          </div>
        </Step>

        <Step n={needsAddress ? 5 : 4} title="Vos coordonnées" done={!!customer.email && !!customer.phone}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom *">
              <input required className="field-box" value={customer.firstName} onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })} autoComplete="given-name" />
            </Field>
            <Field label="Nom *">
              <input required className="field-box" value={customer.lastName} onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })} autoComplete="family-name" />
            </Field>
            <Field label="E-mail *">
              <input required type="email" className="field-box" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} autoComplete="email" />
            </Field>
            <Field label="Téléphone *">
              <input required type="tel" className="field-box" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} autoComplete="tel" />
            </Field>
          </div>
        </Step>
      </div>

      {/* récapitulatif */}
      <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} className="rounded-[2rem] border border-gold/25 bg-aubergine-950/80 p-6 backdrop-blur sm:p-8">
          <p className="eyebrow text-gold">Récapitulatif</p>
          <ul className="mt-5 max-h-[300px] space-y-4 overflow-y-auto pr-1" data-lenis-prevent>
            {lines.map((l) => (
              <li key={l.key} className="flex gap-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-t-full bg-aubergine-800">
                  {l.image ? <SmartImage src={l.image} alt="" fill sizes="56px" className="object-cover" /> : <VioletMark className="m-auto mt-4 h-8 w-8 text-gold/70" />}
                  <span className="absolute -right-0 -top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-ivory px-1 text-[0.6rem] text-noir">{l.quantity}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg leading-tight">{l.name}</p>
                  <p className="truncate text-xs text-ivory/50">{[l.variantName, ...(l.addonNames || [])].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="text-sm tabular-nums">{euro(l.unitPrice * l.quantity)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-ivory/10 pt-5">
            {promoCode ? (
              <div className="flex items-center justify-between rounded-xl bg-gold/10 px-4 py-3 text-sm text-gold-light">
                <span className="flex items-center gap-2">
                  <Tag className="h-4 w-4" /> {promoCode}
                </span>
                <button type="button" onClick={() => setPromoCode("")} aria-label="Retirer le code">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="Code avantage" className="field-box !py-2.5" aria-label="Code avantage" />
                <button type="button" onClick={() => promoInput && setPromoCode(promoInput.trim())} className="btn btn-ghost !px-4 !py-2.5 text-ivory">
                  <span>OK</span>
                </button>
              </div>
            )}
            {quote?.warnings?.map((w) => (
              <p key={w} className="mt-2 text-xs text-gold-light">
                {w}
              </p>
            ))}
          </div>

          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between text-ivory/70">
              <dt>Sous-total</dt>
              <dd className="tabular-nums">{quote ? euro(quote.subtotal) : "…"}</dd>
            </div>
            {mode === "delivery" && (
              <div className="flex justify-between text-ivory/70">
                <dt>Livraison {quote?.zone && <span className="text-ivory/40">· {quote.zone.name}</span>}</dt>
                <dd className="tabular-nums">{!quote?.zone ? "selon code postal" : quote.deliveryFee ? euro(quote.deliveryFee) : "Offerte"}</dd>
              </div>
            )}
            {!!quote?.discount && (
              <div className="flex justify-between text-gold-light">
                <dt>Remise</dt>
                <dd className="tabular-nums">− {euro(quote.discount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-ivory/10 pt-4">
              <dt className="eyebrow">Total</dt>
              <dd className="font-display text-4xl tabular-nums">{quote ? euro(quote.total) : "…"}</dd>
            </div>
          </dl>

          {canPayInStore && (
            <label className="mt-5 flex items-center gap-3 rounded-xl border border-ivory/10 p-3 text-sm text-ivory/75">
              <input type="checkbox" checked={payInStore} onChange={(e) => setPayInStore(e.target.checked)} className="h-4 w-4 accent-[#C6A15B]" />
              Je préfère régler en boutique au retrait
            </label>
          )}

          <label className="mt-5 flex items-start gap-3 text-xs leading-relaxed text-ivory/60">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#C6A15B]" />
            <span>
              J&apos;accepte les{" "}
              <Link href="/cgv" target="_blank" className="underline underline-offset-2">
                conditions générales de vente
              </Link>{" "}
              et la{" "}
              <Link href="/confidentialite" target="_blank" className="underline underline-offset-2">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>

          <AnimatePresence>
            {(error || (quoteError && !needsAddress)) && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-xl bg-rose-950/50 p-3 text-sm text-rose-200" role="alert">
                {error || quoteError}
              </motion.p>
            )}
          </AnimatePresence>

          <button type="submit" disabled={submitting || !!quoteError || !slotId} className="btn btn-gold mt-6 w-full !py-5" data-cursor="link">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>{canPayInStore && payInStore ? "Confirmer la commande" : config.stripeEnabled ? `Payer ${quote ? euro(quote.total) : ""}` : "Valider (démo)"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          <p className="mt-4 flex items-center justify-center gap-2 text-[0.7rem] text-ivory/40">
            <Lock className="h-3 w-3" /> Paiement sécurisé par Stripe · CB, Apple Pay, Google Pay
          </p>
          <p className="mt-2 text-center text-[0.7rem] text-ivory/35">{cartCount(lines)} article(s) · {config.shopAddress}</p>
        </motion.div>
      </aside>
    </form>
  );
}
