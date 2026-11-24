"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { AeImage } from "../AeImage";
import { IconChevronLeft, IconChevronRight, IconClose, IconImages } from "../Icons";

export function Gallery({ images, title, lang }: { images: string[]; title: string; lang: Lang }) {
  const t = getDict(lang).listing;
  const [open, setOpen] = useState<number | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const n = images.length;

  const show = useCallback((i: number) => setOpen(((i % n) + n) % n), [n]);
  const close = useCallback(() => {
    setOpen(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (open === null) return;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % n));
      else if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o - 1 + n) % n));
      else if (e.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button")];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, n, close]);

  if (n === 0) return <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-navy-50 text-ink-soft">{lang === "es" ? "Sin fotos" : "No photos"}</div>;

  const openAt = (i: number, el: HTMLElement) => {
    triggerRef.current = el;
    show(i);
  };

  return (
    <section aria-label={t.gallery}>
      {/* Mobile: swipeable strip */}
      <div className="relative -mx-4 sm:mx-0 md:hidden">
        <div
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:rounded-2xl"
          onScroll={(e) => {
            const el = e.currentTarget;
            setMobileIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {images.slice(0, 12).map((src, i) => (
            <button key={src} type="button" className="relative aspect-[4/3] w-full shrink-0 snap-center" onClick={(e) => openAt(i, e.currentTarget)} aria-label={`${t.photoOf(i + 1, n)} — ${t.openGallery(n)}`}>
              <AeImage src={src} alt={i === 0 ? title : ""} fill sizes="100vw" priority={i === 0} className="object-cover" />
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-navy-900/75 px-3 py-1 text-xs font-medium text-white">
          {Math.min(mobileIndex + 1, n)} / {n}
        </span>
      </div>

      {/* Desktop: mosaic */}
      <div className="hidden gap-2 md:grid md:grid-cols-4 md:grid-rows-2 md:[height:min(56vw,540px)]">
        {images.slice(0, 5).map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={(e) => openAt(i, e.currentTarget)}
            className={`group relative overflow-hidden bg-navy-50 ${i === 0 ? "col-span-2 row-span-2 rounded-l-2xl" : ""} ${i === 2 ? "rounded-tr-2xl" : ""} ${i === 4 || (n < 5 && i === n - 1 && i !== 0) ? "rounded-br-2xl" : ""}`}
            aria-label={t.photoOf(i + 1, n)}
          >
            <AeImage src={src} alt={i === 0 ? title : ""} fill sizes={i === 0 ? "(min-width:1280px) 640px, 50vw" : "(min-width:1280px) 320px, 25vw"} priority={i === 0} className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
            {i === 4 && n > 5 && (
              <span className="absolute inset-0 flex items-center justify-center bg-navy-900/55 text-base font-semibold text-white">+{n - 5}</span>
            )}
          </button>
        ))}
      </div>
      {n > 1 && (
        <button type="button" className="btn-outline mt-3 hidden md:inline-flex" onClick={(e) => openAt(0, e.currentTarget)}>
          <IconImages size={18} /> {t.openGallery(n)}
        </button>
      )}

      {open !== null && (
        <div ref={dialogRef} className="fixed inset-0 z-[70] flex flex-col bg-navy-900/95" role="dialog" aria-modal="true" aria-label={t.gallery}>
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="text-sm" aria-live="polite">{t.photoOf(open + 1, n)}</p>
            <button type="button" data-autofocus onClick={close} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <IconClose size={24} /><span className="sr-only">{t.close}</span>
            </button>
          </div>
          <div
            className="relative flex-1"
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 40) show(open + (dx < 0 ? 1 : -1));
              touchX.current = null;
            }}
          >
            <AeImage key={images[open]} src={images[open]} alt={`${title} — ${t.photoOf(open + 1, n)}`} fill sizes="100vw" ratio={0.75} className="object-contain" />
            {n > 1 && (
              <>
                <button type="button" onClick={() => show(open - 1)} className="absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-4">
                  <IconChevronLeft size={26} /><span className="sr-only">{t.prevPhoto}</span>
                </button>
                <button type="button" onClick={() => show(open + 1)} className="absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-4">
                  <IconChevronRight size={26} /><span className="sr-only">{t.nextPhoto}</span>
                </button>
              </>
            )}
          </div>
          {/* Preload neighbours only */}
          <div className="hidden" aria-hidden>
            {[open + 1, open - 1].map((i) => {
              const src = images[((i % n) + n) % n];
              return <AeImage key={`pre-${src}`} src={src} alt="" width={1200} height={900} sizes="100vw" />;
            })}
          </div>
        </div>
      )}
    </section>
  );
}
