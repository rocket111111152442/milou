import Image from "next/image";
import type { Activity } from "@/lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS, KIND_LABELS } from "@/lib/types";
import { formatDate, formatTime, price } from "@/lib/format";

export function ActivityCardInner({ a, showNext = true }: { a: Activity; showNext?: boolean }) {
  const next = a.sessions[0];
  return (
    <article className="group card flex h-full flex-col overflow-hidden transition duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-30px_rgba(43,42,54,0.5)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        <Image
          src={a.image}
          alt={a.title}
          fill
          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-110"
        />
        <span className={`absolute top-4 left-4 rounded-full ${CATEGORY_COLORS[a.category]} px-3 py-1 text-xs font-extrabold tracking-wide text-white uppercase`}>
          {a.kind === "atelier" ? CATEGORY_LABELS[a.category] : KIND_LABELS[a.kind]}
        </span>
        <span className="absolute top-4 right-4 rounded-full bg-ink px-3 py-1 font-display text-lg font-semibold text-white">{price(a.price)}</span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-sm font-bold text-sage-deep">{a.ageLabel}{a.duration ? ` · ${a.duration}` : ""}{a.host ? ` · avec ${a.host}` : ""}</p>
        <h3 className="mt-1 text-2xl font-semibold">{a.title}</h3>
        <p className="mt-2 line-clamp-3 text-ink-soft">{a.description}</p>
        {a.priceNote && <p className="mt-2 text-sm font-bold text-tomato">{a.priceNote}</p>}
        <div className="mt-auto pt-5">
          {showNext && next ? (
            <p className="rounded-2xl bg-mint px-4 py-2 text-sm font-bold text-sage-deep">
              Prochaine séance : {formatDate(next.date, { weekday: "short", day: "numeric", month: "short" })} à {formatTime(next.start)}
            </p>
          ) : showNext ? (
            <p className="rounded-2xl bg-shell px-4 py-2 text-sm font-bold text-ink-soft">Dates à venir · sur demande</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

