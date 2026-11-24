"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { whatsappLink } from "@/config/site";
import { IconCheck, IconWhatsApp } from "./Icons";

type Variant = "contact" | "property" | "visit" | "sell";

interface Props {
  lang: Lang;
  variant: Variant;
  property?: { slug: string; ref: string | null; title: string } | null;
  formEnabled: boolean;
  defaultIntent?: "buy" | "rent" | "sell" | "other";
}

type Errors = Partial<Record<"fullName" | "contact" | "email" | "phone" | "message" | "consent" | "slots" | "form", string>>;

const SLOT_COUNT = 3;

export function LeadForm({ lang, variant, property, formEnabled, defaultIntent }: Props) {
  const t = getDict(lang).forms;
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const startedAt = useRef(Date.now());
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [doneText, setDoneText] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  const [pageUrl, setPageUrl] = useState("");
  const [tz, setTz] = useState("America/Santo_Domingo");
  useEffect(() => {
    setPageUrl(window.location.href.split("#")[0]);
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Santo_Domingo");
    } catch {
      /* keep default */
    }
  }, []);
  const waText = property ? getDict(lang).listing.waMessage(property.title, property.ref, pageUrl) : undefined;

  if (!formEnabled) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950" role="status">
        <p className="text-sm">{t.unavailable}</p>
        <a href={whatsappLink(waText)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-4"><IconWhatsApp size={18} /> WhatsApp</a>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950" role="status" aria-live="polite" tabIndex={-1}>
        <p className="flex items-center gap-2 font-semibold"><IconCheck size={20} /> {t.successTitle}</p>
        <p className="mt-2 text-sm leading-relaxed">{doneText}</p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const errs: Errors = {};
    const email = get("email");
    const phone = get("phone");
    if (get("fullName").length < 2) errs.fullName = t.errors.name;
    if (!email && !phone) errs.contact = t.errors.contact;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errs.email = t.errors.email;
    if (phone && phone.replace(/\D/g, "").length < 8) errs.phone = t.errors.phone;
    if (get("message").length > 2000) errs.message = t.errors.message;
    if (!fd.get("consent")) errs.consent = t.errors.consent;
    const slots = Array.from({ length: SLOT_COUNT }, (_, i) => get(`slot${i}`)).filter(Boolean);
    if (variant === "visit" && slots.length === 0) errs.slots = t.slotsHint;
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    const intent = (get("intent") || defaultIntent || (variant === "sell" ? "sell" : "buy")) as "buy" | "rent" | "sell" | "other";
    const expected = Number(get("expectedPrice").replace(/[^\d.]/g, ""));
    const body = {
      kind: variant,
      fullName: get("fullName"),
      email: email || null,
      phone: phone || null,
      country: get("country") || null,
      language: lang,
      message: get("message") || null,
      criteria: {
        intent,
        ...(variant === "sell"
          ? {
              propertyTypes: get("propertyType") ? [get("propertyType")] : undefined,
              zones: get("propertyLocation") ? [get("propertyLocation")] : undefined,
              expectedPrice: expected > 0 ? expected : null,
              currency: "USD",
              titleDeslindado: get("titleStatus") || null,
            }
          : {}),
        ...(variant === "visit" ? { visitPreference: get("visitType") as "physical" | "virtual" } : {}),
      },
      property: property ? { slug: property.slug, ref: property.ref, title: property.title } : null,
      visit: variant === "visit" ? { type: get("visitType"), timezone: get("timezone") || "America/Santo_Domingo", slots } : null,
      consent: true,
      website: get("website"),
      startedAt: startedAt.current,
    };

    setStatus("sending");
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fields?: string[] };
      if (res.ok && data.ok) {
        setDoneText(variant === "visit" ? t.visitPending : t.success);
        setStatus("done");
        return;
      }
      setStatus("idle");
      if (res.status === 429) setErrors({ form: t.rateLimited });
      else if (res.status === 400 && data.fields?.length) {
        const fe: Errors = { form: t.invalid };
        for (const f of data.fields) {
          if (f === "email") fe.email = t.errors.email;
          if (f === "phone") fe.phone = t.errors.phone;
          if (f === "contact") fe.contact = t.errors.contact;
          if (f === "fullName") fe.fullName = t.errors.name;
        }
        setErrors(fe);
      } else if (res.status === 503) setErrors({ form: t.unavailable });
      else setErrors({ form: t.error });
      requestAnimationFrame(() => errorRef.current?.focus());
    } catch {
      setStatus("idle");
      setErrors({ form: t.error });
    }
  }

  const errList = Object.values(errors).filter(Boolean);
  const describedBy = (k: keyof Errors) => (errors[k] ? id(`${k}-err`) : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={status === "sending"}>
      {errList.length > 0 && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errors.form ?? t.invalid}
        </div>
      )}
      {property && (
        <p className="rounded-xl bg-navy-50 px-3.5 py-2.5 text-sm text-navy-700">
          <span className="font-semibold">{t.propertyRef}:</span> {property.title}{property.ref ? ` · Ref. ${property.ref}` : ""}
        </p>
      )}
      {/* honeypot */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor={id("website")}>Website</label>
        <input id={id("website")} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor={id("name")} className="field-label">{t.name}</label>
        <input id={id("name")} name="fullName" className="field" autoComplete="name" required aria-invalid={Boolean(errors.fullName)} aria-describedby={describedBy("fullName")} />
        {errors.fullName && <p id={id("fullName-err")} className="field-error">{errors.fullName}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("phone")} className="field-label">{t.phone}</label>
          <input id={id("phone")} name="phone" type="tel" className="field" autoComplete="tel" placeholder="+1 809 000 0000" aria-invalid={Boolean(errors.phone || errors.contact)} aria-describedby={describedBy("phone") ?? describedBy("contact")} />
          {errors.phone && <p id={id("phone-err")} className="field-error">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor={id("email")} className="field-label">{t.email}</label>
          <input id={id("email")} name="email" type="email" className="field" autoComplete="email" aria-invalid={Boolean(errors.email || errors.contact)} aria-describedby={describedBy("email") ?? describedBy("contact")} />
          {errors.email && <p id={id("email-err")} className="field-error">{errors.email}</p>}
        </div>
      </div>
      {errors.contact && <p id={id("contact-err")} className="field-error -mt-2">{errors.contact}</p>}

      {(variant === "contact" || variant === "property") && (
        <div className="grid gap-4 sm:grid-cols-2">
          {variant === "contact" && (
            <div>
              <label htmlFor={id("intent")} className="field-label">{t.intent}</label>
              <select id={id("intent")} name="intent" className="field" defaultValue={defaultIntent ?? "buy"}>
                {(Object.keys(t.intents) as (keyof typeof t.intents)[]).map((k) => <option key={k} value={k}>{t.intents[k]}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor={id("country")} className="field-label">{t.country} <span className="font-normal text-ink-soft">({getDict(lang).common.optional})</span></label>
            <input id={id("country")} name="country" className="field" autoComplete="country-name" />
          </div>
        </div>
      )}

      {variant === "sell" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id("ptype")} className="field-label">{t.propertyType}</label>
            <input id={id("ptype")} name="propertyType" className="field" placeholder={lang === "es" ? "Solar, villa, casa…" : "Land, villa, house…"} />
          </div>
          <div>
            <label htmlFor={id("ploc")} className="field-label">{t.propertyLocation}</label>
            <input id={id("ploc")} name="propertyLocation" className="field" placeholder="Cabrera, Río San Juan…" />
          </div>
          <div>
            <label htmlFor={id("price")} className="field-label">{t.expectedPrice} (USD)</label>
            <input id={id("price")} name="expectedPrice" className="field" inputMode="numeric" />
          </div>
          <div>
            <label htmlFor={id("title")} className="field-label">{t.titleStatus}</label>
            <select id={id("title")} name="titleStatus" className="field" defaultValue="">
              <option value="">—</option>
              <option value="si">{t.yes}</option>
              <option value="no">{t.no}</option>
              <option value="no_sabe">{t.unknown}</option>
            </select>
          </div>
        </div>
      )}

      {variant === "visit" && (
        <>
          <fieldset>
            <legend className="field-label">{t.visitType}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["physical", "virtual"] as const).map((v) => (
                <label key={v} className="relative">
                  <input type="radio" name="visitType" value={v} defaultChecked={v === "physical"} className="peer sr-only" />
                  <span className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-navy-200 text-sm font-medium peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                    {v === "physical" ? t.visitPhysical : t.visitVirtual}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={id("tz")} className="field-label">{t.timezone}</label>
            <input id={id("tz")} name="timezone" className="field" value={tz} onChange={(e) => setTz(e.target.value)} />
          </div>
          <fieldset aria-describedby={id("slots-hint")}>
            <legend className="field-label">{t.slots}</legend>
            <p id={id("slots-hint")} className="mb-2 text-sm text-ink-muted">{t.slotsHint}</p>
            <div className="grid gap-2">
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <div key={i}>
                  <label htmlFor={id(`slot${i}`)} className="sr-only">{t.slot(i + 1)}</label>
                  <input id={id(`slot${i}`)} name={`slot${i}`} type="datetime-local" className="field" aria-invalid={i === 0 && Boolean(errors.slots)} />
                </div>
              ))}
            </div>
            {errors.slots && <p className="field-error">{errors.slots}</p>}
          </fieldset>
        </>
      )}

      <div>
        <label htmlFor={id("msg")} className="field-label">{t.message} <span className="font-normal text-ink-soft">({getDict(lang).common.optional})</span></label>
        <textarea id={id("msg")} name="message" rows={4} maxLength={2000} className="field min-h-[110px]" placeholder={t.messagePh} aria-invalid={Boolean(errors.message)} />
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm leading-snug text-ink-muted">
          <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 shrink-0 rounded border-navy-200 accent-[#EB6500]" aria-invalid={Boolean(errors.consent)} aria-describedby={describedBy("consent")} />
          <span>
            {t.consent}{" "}
            <Link href={href(lang, "privacy")} className="font-medium text-navy underline underline-offset-2">{getDict(lang).footer.privacy}</Link>
          </span>
        </label>
        {errors.consent && <p id={id("consent-err")} className="field-error">{errors.consent}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={status === "sending"}>{status === "sending" ? t.sending : variant === "visit" ? getDict(lang).listing.requestVisit : t.send}</button>
        <a href={whatsappLink(waText)} target="_blank" rel="noopener noreferrer" className="btn-ghost text-[#187540]"><IconWhatsApp size={18} /> WhatsApp</a>
      </div>
    </form>
  );
}
