"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EASE, roman } from "@/components/herbier/Elements";
import { Plate } from "@/components/herbier/Plate";
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
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: n * 0.06 }} className="border-t border-ink/20 pb-12 pt-6">
      <div className="mb-7 flex items-baseline gap-4">
        <span className="w-10 shrink-0 font-text text-[0.95rem] italic text-ink-muted">{roman(n)}.</span>
        <h2 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] leading-tight">{title}</h2>
        <AnimatePresence>
          {done && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-auto shrink-0 font-text text-[0.88rem] italic text-plum">
              ✓ noté
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="sm:pl-14">{children}</div>
    </motion.section>
  );
}

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={cn("block", className)}>
    <span className="f-label">{label}</span>
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
          { id: "delivery", label: "Livraison", sub: "à domicile, au bureau, au funérarium", on: config.deliveryEnabled },
          { id: "pickup", label: "Retrait en boutique", sub: "gratuit", on: config.pickupEnabled },
          { id: "drive", label: "Drive", sub: "on vous l'apporte à la voiture", on: config.driveEnabled },
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
      <div className="wrap flex min-h-[50vh] flex-col items-center justify-center pb-24 text-center">
        <Plate name="brins" reveal="mount" className="w-64 text-ink-soft" />
        <p className="mt-8 font-display text-[2.2rem] italic">Votre panier est vide.</p>
        <Link href="/boutique" className="btn-line mt-6">
          Voir la boutique <span className="arrow">→</span>
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
    <form onSubmit={submit} className="wrap grid gap-14 pb-32 lg:grid-cols-[1.45fr_1fr] lg:gap-16">
      <div className="min-w-0">
        {cancelled && <p className="mb-8 border-l-2 border-plum pl-4 font-text text-[1rem] italic text-ink-soft">Le paiement a été annulé. Votre panier est intact : vous pouvez réessayer.</p>}
        {!config.stripeEnabled && (
          <p className="mb-8 border-l-2 border-foil pl-4 font-text text-[1rem] text-ink-soft">
            <span className="font-display italic">Mode démonstration</span> — le paiement Stripe n&apos;est pas encore activé : la commande sera enregistrée sans paiement réel.
          </p>
        )}

        <Step n={1} title="Comment recevoir vos fleurs ?" done={!!mode}>
          <div className="border-t border-ink/15">
            {modes.map((m) => {
              const on = mode === m.id;
              return (
                <label key={m.id} className={cn("flex cursor-pointer items-baseline gap-4 border-b border-ink/15 py-4 font-text", on ? "text-ink" : "text-ink-soft hover:text-ink")}>
                  <input type="radio" name="mode" className="sr-only" checked={on} onChange={() => setMode(m.id)} />
                  <span className="radio-dot translate-y-[1px]" data-on={on} aria-hidden />
                  <span className={cn("font-display text-[1.4rem]", on && "italic")}>{m.label}</span>
                  <span className="leader" />
                  <span className="text-right text-[0.95rem] italic text-ink-muted">{m.sub}</span>
                </label>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            {mode !== "delivery" && (
              <motion.p key={mode} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 font-text text-[1rem] italic text-ink-soft">
                {mode === "pickup" ? config.pickupNote : config.driveNote}
              </motion.p>
            )}
          </AnimatePresence>
        </Step>

        <Step n={2} title="Pour quel jour ?" done={!!date && !!slotId}>
          {!days ? (
            <p className="font-text italic text-ink-muted">Consultation du carnet de rendez-vous…</p>
          ) : (
            <>
              <p className="sc mb-3 text-ink-muted">{months.map((m) => MONTHS[m]).join(" · ")}</p>
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-3 no-scrollbar" data-lenis-prevent>
                {days.map((d) => {
                  const on = d.date === date;
                  return (
                    <button
                      type="button"
                      key={d.date}
                      disabled={!d.open}
                      onClick={() => setDate(d.date)}
                      title={d.reason}
                      aria-pressed={on}
                      className={cn(
                        "relative flex w-[3.6rem] shrink-0 flex-col items-center border py-2.5 font-text transition-colors duration-300",
                        on ? "border-ink bg-ink text-paper" : d.open ? "border-ink/15 hover:border-ink/50" : "cursor-not-allowed border-transparent text-ink-faint line-through decoration-ink/30",
                      )}
                    >
                      <span className="text-[0.62rem] uppercase tracking-[0.14em] opacity-70">{DAYS_SHORT[d.weekday].replace(".", "")}</span>
                      <span className="tab font-display text-[1.55rem] leading-tight">{Number(d.date.slice(8))}</span>
                      <span className="text-[0.62rem] italic opacity-60">{MONTHS[Number(d.date.slice(5, 7)) - 1].slice(0, 4)}.</span>
                    </button>
                  );
                })}
              </div>
              {day && (
                <div className="mt-5 border-t border-ink/15">
                  {day.slots.map((s) => {
                    const on = slotId === s.id;
                    return (
                      <label key={s.id} className={cn("flex items-baseline gap-4 border-b border-ink/15 py-3.5 font-text text-[1.05rem]", s.available ? "cursor-pointer" : "cursor-not-allowed text-ink-faint", on ? "text-ink" : s.available && "text-ink-soft hover:text-ink")}>
                        <input type="radio" name="slot" className="sr-only" disabled={!s.available} checked={on} onChange={() => setSlotId(s.id)} />
                        <span className="radio-dot translate-y-[1px]" data-on={on} aria-hidden />
                        <span className={on ? "italic" : ""}>{s.label}</span>
                        <span className="leader" />
                        <span className="text-[0.92rem] italic">{s.available ? (on ? "retenu" : "disponible") : s.reason}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {date && <p className="mt-5 font-display text-[1.35rem] italic">{frDate(date).charAt(0).toUpperCase() + frDate(date).slice(1)}.</p>}
            </>
          )}
        </Step>

        {needsAddress && (
          <Step n={3} title="À qui livrons-nous ?" done={!!recipient.address && !!recipient.postcode && !deliveryPostcodeIssue}>
            <label className="mb-7 flex cursor-pointer items-center gap-3 font-text text-[1rem] text-ink-soft">
              <input type="checkbox" className="sr-only" checked={sameAsMe} onChange={(e) => setSameAsMe(e.target.checked)} />
              <span className="check-box" data-on={sameAsMe} aria-hidden />
              Les fleurs sont pour moi
            </label>
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Field label="Nom du destinataire *">
                <input required className="f-line" value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} autoComplete="shipping name" />
              </Field>
              <Field label="Téléphone du destinataire *">
                <input required className="f-line tab" type="tel" value={recipient.phone} onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })} />
              </Field>
              <Field label="Adresse *" className="sm:col-span-2">
                <input required className="f-line" value={recipient.address} onChange={(e) => setRecipient({ ...recipient, address: e.target.value })} autoComplete="shipping address-line1" placeholder="numéro et rue" />
              </Field>
              <Field label="Complément" className="sm:col-span-2">
                <input className="f-line" value={recipient.address2} onChange={(e) => setRecipient({ ...recipient, address2: e.target.value })} autoComplete="shipping address-line2" placeholder="bâtiment, étage, funérarium…" />
              </Field>
              <Field label="Code postal *">
                <input
                  required
                  inputMode="numeric"
                  maxLength={5}
                  className={cn("f-line tab", deliveryPostcodeIssue && "!border-[#9b3b3b]")}
                  value={recipient.postcode}
                  onChange={(e) => setRecipient({ ...recipient, postcode: e.target.value.replace(/\D/g, "") })}
                  autoComplete="shipping postal-code"
                />
              </Field>
              <Field label="Ville *">
                <input required className="f-line" value={recipient.city} onChange={(e) => setRecipient({ ...recipient, city: e.target.value })} autoComplete="shipping address-level2" />
              </Field>
              <Field label="Entreprise">
                <input className="f-line" value={recipient.company} onChange={(e) => setRecipient({ ...recipient, company: e.target.value })} />
              </Field>
              <Field label="Instructions de livraison">
                <input className="f-line" value={recipient.instructions} onChange={(e) => setRecipient({ ...recipient, instructions: e.target.value })} placeholder="digicode, heure de cérémonie…" />
              </Field>
            </div>
            <AnimatePresence>
              {/^\d{5}$/.test(recipient.postcode) && quote && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={cn("mt-5 font-text text-[1rem] italic", quoteError ? "text-[#9b3b3b]" : "text-plum")}>
                  {quoteError ? quoteError : quote.zone ? `${quote.zone.name} — livraison ${quote.deliveryFee ? euro(quote.deliveryFee) : "offerte"}.` : null}
                </motion.p>
              )}
            </AnimatePresence>
          </Step>
        )}

        <Step n={needsAddress ? 4 : 3} title="Un mot sur la carte ?" done={!!cardMessage}>
          <div className="grid gap-10 md:grid-cols-[1fr_0.9fr]">
            <div className="space-y-6">
              <Field label="Votre message, écrit à la main par la fleuriste">
                <textarea className="f-line min-h-[110px] resize-none" maxLength={400} value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} placeholder="Joyeux anniversaire…" />
              </Field>
              <Field label="Signature">
                <input className="f-line" maxLength={80} value={cardSignature} onChange={(e) => setCardSignature(e.target.value)} placeholder="Avec toute mon affection, Julien" disabled={anonymous} />
              </Field>
              <label className="flex cursor-pointer items-center gap-3 font-text text-[1rem] text-ink-soft">
                <input type="checkbox" className="sr-only" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                <span className="check-box" data-on={anonymous} aria-hidden />
                Envoi anonyme
              </label>
            </div>
            <motion.div className="sheet relative flex min-h-[230px] items-center justify-center p-8" initial={{ rotate: -1.5 }} animate={{ rotate: cardMessage ? 0.8 : -1.5 }} transition={{ duration: 0.8, ease: EASE }}>
              <Plate name="violette" reveal="none" opacity={0.12} className="absolute right-3 top-3 w-16 text-ink" />
              <div className="absolute inset-3 border border-ink/10" />
              <div className="relative text-center">
                <p className="whitespace-pre-wrap font-display text-[1.35rem] italic leading-snug">{cardMessage || "Votre message apparaîtra ici…"}</p>
                {!anonymous && cardSignature && <p className="mt-4 font-text text-[1rem] italic text-ink-soft">— {cardSignature}</p>}
              </div>
            </motion.div>
          </div>
        </Step>

        <Step n={needsAddress ? 5 : 4} title="Vos coordonnées" done={!!customer.email && !!customer.phone}>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <Field label="Prénom *">
              <input required className="f-line" value={customer.firstName} onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })} autoComplete="given-name" />
            </Field>
            <Field label="Nom *">
              <input required className="f-line" value={customer.lastName} onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })} autoComplete="family-name" />
            </Field>
            <Field label="E-mail *">
              <input required type="email" className="f-line" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} autoComplete="email" />
            </Field>
            <Field label="Téléphone *">
              <input required type="tel" className="f-line tab" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} autoComplete="tel" />
            </Field>
          </div>
        </Step>
      </div>

      {/* bon de commande */}
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.2 }} className="sheet perf-top px-6 pb-7 pt-9 sm:px-8">
          <div className="flex items-baseline justify-between">
            <p className="sc">Bon de commande</p>
            <p className="folio text-ink-muted">{cartCount(lines)} article{cartCount(lines) > 1 ? "s" : ""}</p>
          </div>
          <ul className="mt-5 max-h-[300px] space-y-4 overflow-y-auto pr-1" data-lenis-prevent>
            {lines.map((l) => (
              <li key={l.key} className="flex gap-3">
                <div className="relative h-[60px] w-[48px] shrink-0 overflow-hidden bg-paper-deep">
                  {l.image ? <SmartImage src={l.image} alt="" fill sizes="48px" className="tirage object-cover" /> : <Plate name="bouquet-ancien" fit="contain" reveal="none" className="absolute inset-1 text-ink-soft" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline">
                    <p className="truncate font-display text-[1.1rem] leading-tight">
                      {l.quantity > 1 && <span className="tab font-text text-[0.95rem] text-ink-muted">{l.quantity} × </span>}
                      {l.name}
                    </p>
                    <span className="leader !min-w-[0.75rem]" />
                    <p className="tab shrink-0 font-text text-[0.98rem]">{euro(l.unitPrice * l.quantity)}</p>
                  </div>
                  <p className="truncate font-text text-[0.85rem] italic text-ink-muted">{[l.variantName, ...(l.addonNames || [])].filter(Boolean).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-ink/15 pt-5">
            {promoCode ? (
              <p className="flex items-baseline justify-between font-text text-[0.98rem]">
                <span>
                  Code <span className="font-display italic">{promoCode}</span>
                </span>
                <button type="button" onClick={() => setPromoCode("")} className="ulink-on text-[0.9rem] italic text-ink-muted">
                  retirer
                </button>
              </p>
            ) : (
              <div className="flex items-end gap-3">
                <input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="Code avantage" className="f-line !py-1.5 !text-[0.98rem] uppercase tracking-[0.08em] placeholder:normal-case placeholder:tracking-normal" aria-label="Code avantage" />
                <button type="button" onClick={() => promoInput && setPromoCode(promoInput.trim())} className="sc shrink-0 pb-2">
                  Appliquer
                </button>
              </div>
            )}
            {quote?.warnings?.map((w) => (
              <p key={w} className="mt-2 font-text text-[0.88rem] italic text-plum">
                {w}
              </p>
            ))}
          </div>

          <dl className="mt-6 space-y-2 font-text text-[1rem]">
            <div className="flex items-baseline text-ink-soft">
              <dt>Sous-total</dt>
              <span className="leader" />
              <dd className="tab">{quote ? euro(quote.subtotal) : "…"}</dd>
            </div>
            {mode === "delivery" && (
              <div className="flex items-baseline text-ink-soft">
                <dt className="truncate">Livraison{quote?.zone && <span className="italic text-ink-muted"> · {quote.zone.name}</span>}</dt>
                <span className="leader" />
                <dd className="tab shrink-0">{!quote?.zone ? <span className="italic">selon l&apos;adresse</span> : quote.deliveryFee ? euro(quote.deliveryFee) : "offerte"}</dd>
              </div>
            )}
            {!!quote?.discount && (
              <div className="flex items-baseline text-plum">
                <dt>Remise</dt>
                <span className="leader" />
                <dd className="tab">− {euro(quote.discount)}</dd>
              </div>
            )}
            <div className="flex items-baseline border-t border-ink/15 pt-4">
              <dt className="sc">Total TTC</dt>
              <span className="leader" />
              <dd className="tab font-text text-[2rem] leading-none">{quote ? euro(quote.total) : "…"}</dd>
            </div>
          </dl>

          {canPayInStore && (
            <label className="mt-6 flex cursor-pointer items-center gap-3 font-text text-[0.98rem] text-ink-soft">
              <input type="checkbox" className="sr-only" checked={payInStore} onChange={(e) => setPayInStore(e.target.checked)} />
              <span className="check-box" data-on={payInStore} aria-hidden />
              Je préfère régler en boutique au retrait
            </label>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 font-text text-[0.9rem] leading-relaxed text-ink-soft">
            <input type="checkbox" className="sr-only" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span className="check-box mt-[0.3em]" data-on={terms} aria-hidden />
            <span>
              J&apos;accepte les{" "}
              <Link href="/cgv" target="_blank" className="ulink-on">
                conditions générales de vente
              </Link>{" "}
              et la{" "}
              <Link href="/confidentialite" target="_blank" className="ulink-on">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>

          <AnimatePresence>
            {(error || (quoteError && !needsAddress)) && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 border-l-2 border-[#9b3b3b] pl-3 font-text text-[0.95rem] italic text-[#7d2d2d]" role="alert">
                {error || quoteError}
              </motion.p>
            )}
          </AnimatePresence>

          <button type="submit" disabled={submitting || !!quoteError || !slotId} className="btn-label mt-6 w-full !py-5">
            <span>{submitting ? "Un instant…" : canPayInStore && payInStore ? "Confirmer la commande" : config.stripeEnabled ? `Payer ${quote ? euro(quote.total) : ""}` : "Valider la commande (démo)"}</span>
          </button>
          <p className="mt-4 text-center font-text text-[0.82rem] italic text-ink-muted">Paiement sécurisé par Stripe · carte, Apple Pay, Google Pay</p>
          <p className="mt-1 text-center font-text text-[0.82rem] italic text-ink-faint">{config.shopAddress}</p>
        </motion.div>
      </aside>
    </form>
  );
}
