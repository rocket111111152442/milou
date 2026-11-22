export function Marquee({ items, className, reverse = false }: { items: string[]; className?: string; reverse?: boolean }) {
  const row = [...items, ...items];
  return (
    <div className={`overflow-hidden ${className ?? ""}`} aria-hidden>
      <div className={`flex w-max animate-marquee gap-8 ${reverse ? "[animation-direction:reverse]" : ""}`}>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-8 font-display text-3xl font-semibold whitespace-nowrap sm:text-5xl">
            {t}
            <svg viewBox="0 0 100 100" className="h-7 w-7 shrink-0 sm:h-9 sm:w-9">
              <path fill="currentColor" opacity=".55" d="M50 4c4 22 9 31 21 36 9 3 17 5 25 10-8 5-16 7-25 10-12 5-17 14-21 36-4-22-9-31-21-36-9-3-17-5-25-10 8-5 16-7 25-10C41 35 46 26 50 4Z" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
