export default function Marquee({
  items,
  reverse = false,
  className = "",
  duration = 30,
}: {
  items: string[];
  reverse?: boolean;
  className?: string;
  duration?: number;
}) {
  const row = [...items, ...items];
  return (
    <div className={`overflow-hidden ${className}`}>
      <div
        className="flex w-max animate-marquee"
        style={{ ["--marquee-duration" as string]: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {row.map((it, i) => (
          <span key={i} className="font-display flex items-center gap-8 pr-8 text-5xl sm:text-7xl">
            {it}
            <span className="inline-block h-3 w-3 rotate-45 bg-current opacity-60" />
          </span>
        ))}
      </div>
    </div>
  );
}
