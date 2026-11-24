import { Fragment } from "react";

/** Splits a title into words that rise one after another (CSS only; reduced motion shows it at once). */
export function Words({ text, delay = 0, step = 70, accentLast = 0, accentClass = "italic text-brand-200" }: { text: string; delay?: number; step?: number; accentLast?: number; accentClass?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      <span aria-hidden>
        {words.map((w, i) => (
          <Fragment key={i}>
            <span className="word">
              <span style={{ ["--d" as string]: `${delay + i * step}ms` }} className={i >= words.length - accentLast ? accentClass : undefined}>{w}</span>
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}
