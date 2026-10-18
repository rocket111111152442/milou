import { Monogram } from "./Logo";

/** Macaron circulaire qui tourne lentement. */
export function RotatingBadge({
  text = "Pétri · Façonné · Cuit sur place · Sanary · Six-Fours · ",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={`relative grid h-full w-full place-items-center ${className}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-spin-slow" aria-hidden="true">
        <defs>
          <path id="badge-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        {/* textLength = circonférence (2π × 78) : le texte remplit exactement le cercle */}
        <text fontSize="12.5" fill="currentColor" fontFamily="var(--font-sans)" fontWeight="700" style={{ textTransform: "uppercase" }}>
          <textPath href="#badge-circle" textLength="488" lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </svg>
      <Monogram className="h-[38%] w-[38%]" />
      <span className="sr-only">{text}</span>
    </div>
  );
}
