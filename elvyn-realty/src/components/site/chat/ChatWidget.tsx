"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site, whatsappLink } from "@/config/site";
import { AeImage } from "../AeImage";
import { IconChat, IconClose, IconPhone, IconSend, IconWhatsApp, IconBed, IconBath, IconArea, IconPin } from "../Icons";
import type { ChatPageContext } from "./PageContext";

interface Card {
  slug: string; ref: string | null; title: string; image: string | null; price: string | null; pricePrefix: string | null; priceSuffix: string | null;
  location: string; type: string | null; bedrooms: number | null; bathrooms: number | null; area: string | null; url: string; reason: string;
}
interface HandoffView { reason: string; summary: string; includeVisitForm: boolean; propertySlug: string | null; status: string }
interface Prefill { fullName?: string | null; email?: string | null; phone?: string | null; country?: string | null }
interface Msg {
  role: "user" | "assistant" | "notice";
  text: string;
  cards?: Card[];
  handoff?: HandoffView | null;
  prefill?: Prefill;
  kind?: "fallback" | "limit" | "error" | "done";
}

/** Minimal safe formatter: **bold**, line breaks and "- " bullets. No HTML injection. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
    );
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-•*]|\d+\.)\s+/.test(l)))
          return (
            <ul key={i} className="my-1 list-disc space-y-1 pl-5">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-•*]|\d+\.)\s+/, ""))}</li>)}
            </ul>
          );
        return (
          <p key={i} className="[&:not(:first-child)]:mt-2">
            {lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}
          </p>
        );
      })}
    </>
  );
}

function PropertyCard({ c, why }: { c: Card; why: string }) {
  return (
    <li className="overflow-hidden rounded-xl border border-navy-100 bg-white">
      <Link href={c.url} className="flex gap-3 p-2 hover:bg-navy-50">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-navy-50">
          {c.image && <AeImage src={c.image} alt="" fill sizes="96px" className="object-cover" />}
        </div>
        <div className="min-w-0 py-0.5">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-navy">{c.title}</p>
          <p className="mt-0.5 text-sm font-semibold text-brand-700">{[c.pricePrefix, c.price].filter(Boolean).join(" ")}{c.priceSuffix ?? ""}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            {c.location && <span className="flex items-center gap-0.5"><IconPin size={12} />{c.location}</span>}
            {c.bedrooms ? <span className="flex items-center gap-0.5"><IconBed size={12} />{c.bedrooms}</span> : null}
            {c.bathrooms ? <span className="flex items-center gap-0.5"><IconBath size={12} />{c.bathrooms}</span> : null}
            {c.area && <span className="flex items-center gap-0.5"><IconArea size={12} />{c.area}</span>}
          </p>
        </div>
      </Link>
      {c.reason && <p className="border-t border-navy-100 bg-sand px-3 py-1.5 text-xs text-ink-muted"><span className="font-semibold text-navy-700">{why}:</span> {c.reason}</p>}
    </li>
  );
}

function HandoffCard({ lang, h, prefill, onDone }: { lang: Lang; h: HandoffView; prefill?: Prefill; onDone: (visit: boolean) => void }) {
  const t = getDict(lang);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const waText = `${lang === "es" ? "Hola Elvyn, vengo del asistente de la web." : "Hello Elvyn, I'm coming from the website assistant."}\n${h.summary}`.slice(0, 1500);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    if (g("fullName").length < 2) return setErr(t.forms.errors.name);
    if (!g("phone") && !g("email")) return setErr(t.forms.errors.contact);
    if (!fd.get("consent")) return setErr(t.forms.errors.consent);
    const slots = [g("slot0"), g("slot1"), g("slot2")].filter(Boolean);
    if (h.includeVisitForm && slots.length === 0) return setErr(t.forms.slotsHint);
    setErr(null);
    setState("sending");
    const res = await fetch("/api/chat/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: g("fullName"),
        phone: g("phone") || null,
        email: g("email") || null,
        country: g("country") || null,
        consent: true,
        visit: h.includeVisitForm ? { type: g("visitType") || "physical", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, slots } : null,
      }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { ok?: boolean; fields?: string[] }) : {};
    if (res?.ok && data.ok) return onDone(h.includeVisitForm);
    setState("error");
    setErr(res?.status === 400 ? t.forms.invalid : res?.status === 429 ? t.forms.rateLimited : t.forms.error);
  }
  const fid = (s: string) => `hc-${s}`;
  return (
    <form onSubmit={submit} className="mt-2 space-y-2.5 rounded-xl border border-brand/30 bg-brand-50 p-3" noValidate>
      <p className="text-sm font-semibold text-navy">{h.includeVisitForm ? t.forms.visitTitle : t.chat.handoffTitle}</p>
      <p className="text-xs text-ink-muted">{t.chat.handoffText}</p>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">{err}</p>}
      <div>
        <label htmlFor={fid("name")} className="text-xs font-medium text-navy-800">{t.forms.name}</label>
        <input id={fid("name")} name="fullName" defaultValue={prefill?.fullName ?? ""} className="field min-h-[40px] py-2 text-sm" autoComplete="name" />
      </div>
      <div>
        <label htmlFor={fid("phone")} className="text-xs font-medium text-navy-800">{t.forms.phone}</label>
        <input id={fid("phone")} name="phone" type="tel" defaultValue={prefill?.phone ?? ""} className="field min-h-[40px] py-2 text-sm" autoComplete="tel" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={fid("email")} className="text-xs font-medium text-navy-800">{t.forms.email}</label>
          <input id={fid("email")} name="email" type="email" defaultValue={prefill?.email ?? ""} className="field min-h-[40px] py-2 text-sm" autoComplete="email" />
        </div>
        <div>
          <label htmlFor={fid("country")} className="text-xs font-medium text-navy-800">{t.forms.country}</label>
          <input id={fid("country")} name="country" defaultValue={prefill?.country ?? ""} className="field min-h-[40px] py-2 text-sm" autoComplete="country-name" />
        </div>
      </div>
      {h.includeVisitForm && (
        <>
          <fieldset>
            <legend className="text-xs font-medium text-navy-800">{t.forms.visitType}</legend>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(["physical", "virtual"] as const).map((v) => (
                <label key={v} className="relative">
                  <input type="radio" name="visitType" value={v} defaultChecked={v === "physical"} className="peer sr-only" />
                  <span className="flex min-h-[40px] cursor-pointer items-center justify-center rounded-lg border border-navy-200 bg-white text-xs font-medium peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{v === "physical" ? t.forms.visitPhysical : t.forms.visitVirtual}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-medium text-navy-800">{t.forms.slots}</legend>
            <p className="text-[11px] text-ink-muted">{t.forms.slotsHint}</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="mt-1">
                <label htmlFor={fid(`slot${i}`)} className="sr-only">{t.forms.slot(i + 1)}</label>
                <input id={fid(`slot${i}`)} name={`slot${i}`} type="datetime-local" className="field min-h-[40px] py-1.5 text-sm" />
              </div>
            ))}
          </fieldset>
        </>
      )}
      <label className="flex items-start gap-2 text-[11px] leading-snug text-ink-muted">
        <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 shrink-0 accent-[#EB6500]" />
        <span>{t.forms.consent} <Link href={href(lang, "privacy")} className="underline">{t.footer.privacy}</Link></span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary min-h-[40px] px-4" disabled={state === "sending"}>{state === "sending" ? t.forms.sending : t.chat.handoffSend}</button>
        <a href={whatsappLink(waText)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp min-h-[40px] px-3 text-xs"><IconWhatsApp size={16} /> {t.chat.whatsappSummary}</a>
      </div>
    </form>
  );
}

export function ChatWidget({ lang, enabled }: { lang: Lang; enabled: boolean }) {
  const t = getDict(lang).chat;
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<ChatPageContext>({ type: "other" });
  const [available, setAvailable] = useState(enabled);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const w = window as unknown as { __eaPage?: ChatPageContext };
    if (w.__eaPage) setPage(w.__eaPage);
    const onPage = (e: Event) => setPage((e as CustomEvent<ChatPageContext>).detail ?? { type: "other" });
    const onOpen = () => setOpen(true);
    window.addEventListener("ea:page", onPage);
    window.addEventListener("ea:open-chat", onOpen);
    return () => {
      window.removeEventListener("ea:page", onPage);
      window.removeEventListener("ea:open-chat", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d: { available?: boolean; messages?: Msg[] }) => {
        if (typeof d.available === "boolean") setAvailable(d.available);
        if (d.messages?.length) setMessages(d.messages.map((m) => ({ ...m, handoff: m.handoff ? { ...m.handoff, status: "proposed" } : null })));
      })
      .catch(() => undefined);
  }, [open, loaded]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim().slice(0, 1000);
      if (!msg || busy) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", text: msg }]);
      if (!available) {
        setMessages((m) => [...m, { role: "notice", text: t.fallbackText, kind: "fallback" }]);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, lang, page: { type: page.type, slug: page.slug ?? null, title: page.title ?? null } }),
        });
        const d = (await res.json().catch(() => ({ mode: "error" }))) as { mode: string; text?: string; cards?: Card[]; handoff?: HandoffView | null; prefill?: Prefill };
        if (d.mode === "ok" || d.mode === "refusal") setMessages((m) => [...m, { role: "assistant", text: d.text ?? "", cards: d.cards, handoff: d.handoff ?? null, prefill: d.prefill }]);
        else if (d.mode === "limit") setMessages((m) => [...m, { role: "notice", text: t.limitReached, kind: "limit" }]);
        else if (d.mode === "fallback") {
          setAvailable(false);
          setMessages((m) => [...m, { role: "notice", text: t.fallbackText, kind: "fallback" }]);
        } else setMessages((m) => [...m, { role: "notice", text: t.error, kind: "error" }]);
      } catch {
        setMessages((m) => [...m, { role: "notice", text: t.error, kind: "error" }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, available, lang, page, t],
  );

  async function newChat() {
    await fetch("/api/chat", { method: "DELETE" }).catch(() => undefined);
    setMessages([]);
    setAvailable(enabled);
    inputRef.current?.focus();
  }

  const intro = page.type === "listing" && page.title ? t.introProperty(page.title) : t.intro;
  const waGeneric = whatsappLink(page.type === "listing" && page.title ? getDict(lang).listing.waMessage(page.title, null, typeof window !== "undefined" ? window.location.href : "") : undefined);

  return (
    <>
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-navy sm:w-auto sm:pl-4 sm:pr-5 text-sm font-semibold text-white shadow-lift transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:bottom-6 sm:right-6 [body.has-actionbar_&]:bottom-[84px] lg:[body.has-actionbar_&]:bottom-6"
          aria-haspopup="dialog"
        >
          <IconChat size={22} />
          <span className="sr-only sm:not-sr-only">{t.title}</span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-modal="false" aria-labelledby="chat-title" className="fixed inset-0 z-[55] flex flex-col bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(680px,calc(100vh-48px))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-navy-100 sm:shadow-lift">
          <div className="flex items-center gap-3 border-b border-navy-100 bg-navy px-4 py-3 text-white sm:rounded-t-2xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand"><IconChat size={18} /></span>
            <div className="min-w-0 flex-1">
              <h2 id="chat-title" className="text-sm font-semibold text-white">{t.title}</h2>
              <p className="truncate text-xs text-navy-100">{t.subtitle}</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={newChat} className="rounded-full px-2.5 py-1.5 text-xs font-medium text-navy-100 hover:bg-white/10">{t.newChat}</button>
            )}
            <button type="button" onClick={() => { setOpen(false); setTimeout(() => buttonRef.current?.focus(), 0); }} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
              <IconClose size={20} /><span className="sr-only">{t.close}</span>
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-relevant="additions">
            <p className="rounded-xl bg-sand p-3 text-[12px] leading-snug text-ink-muted">
              {t.notice} <Link href={href(lang, "privacy")} className="underline">{t.privacyLink}</Link>
            </p>
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-navy-50 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink">{intro}</div>
            {messages.length === 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={lang === "es" ? "Sugerencias" : "Suggestions"}>
                {t.suggestions.map((s) => (
                  <li key={s}><button type="button" onClick={() => send(s)} className="min-h-[36px] rounded-full border border-navy-200 px-3 text-[13px] font-medium text-navy hover:border-navy hover:bg-navy-50">{s}</button></li>
                ))}
              </ul>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-md bg-navy px-3.5 py-2.5 text-[14px] leading-relaxed text-white">{m.text}</div>
              ) : m.role === "assistant" ? (
                <div key={i} className="max-w-[92%]">
                  {m.text && <div className="rounded-2xl rounded-tl-md bg-navy-50 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink"><RichText text={m.text} /></div>}
                  {m.cards && m.cards.length > 0 && <ul className="mt-2 space-y-2">{m.cards.map((c) => <PropertyCard key={c.slug} c={c} why={t.cardWhy} />)}</ul>}
                  {m.handoff && m.handoff.status !== "sent" && (
                    <HandoffCard
                      lang={lang}
                      h={m.handoff}
                      prefill={m.prefill}
                      onDone={(visit) =>
                        setMessages((all) => [
                          ...all.map((x, j) => (j === i ? { ...x, handoff: { ...x.handoff!, status: "sent" } } : x)),
                          { role: "notice", text: visit ? t.visitDone : m.handoff?.reason === "property_search" ? t.searchDone : t.handoffDone, kind: "done" },
                        ])
                      }
                    />
                  )}
                </div>
              ) : (
                <div key={i} role={m.kind === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-[13px] leading-snug ${m.kind === "done" ? "bg-emerald-50 text-emerald-900" : m.kind === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-950"}`}>
                  {m.kind === "fallback" && <p className="font-semibold">{t.fallbackTitle}</p>}
                  <p>{m.text}</p>
                  {(m.kind === "fallback" || m.kind === "limit") && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Link href={href(lang, "catalog")} className="btn-dark min-h-[38px] px-3 text-xs">{t.browse}</Link>
                      <a href={waGeneric} target="_blank" rel="noopener noreferrer" className="btn-whatsapp min-h-[38px] px-3 text-xs"><IconWhatsApp size={15} /> WhatsApp</a>
                      <a href={`tel:${site.phone.e164}`} className="btn-outline min-h-[38px] px-3 text-xs"><IconPhone size={15} /> {site.phone.display}</a>
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-ink-muted" role="status">
                <span className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy-400" style={{ animationDelay: `${d * 120}ms` }} />)}
                </span>
                {t.thinking}
              </div>
            )}
          </div>

          <div className="border-t border-navy-100 p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">{t.placeholder}</label>
              <textarea
                id="chat-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={1000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder={t.placeholder}
                className="field max-h-32 min-h-[44px] resize-none py-2.5 text-[15px]"
              />
              <button type="submit" disabled={busy || !input.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-600 disabled:opacity-50">
                <IconSend size={18} /><span className="sr-only">{t.send}</span>
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-soft">{t.human}:</span>
              <span className="flex gap-1.5">
                <a href={waGeneric} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-emerald-50 px-2.5 font-medium text-[#187540] hover:bg-emerald-100"><IconWhatsApp size={14} /> WhatsApp</a>
                <a href={`tel:${site.phone.e164}`} className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-navy-50 px-2.5 font-medium text-navy hover:bg-navy-100"><IconPhone size={14} /> {lang === "es" ? "Llamar" : "Call"}</a>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
