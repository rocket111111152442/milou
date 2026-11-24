import { useId } from "react";

export function AssistantOrb({ state = "muted", small = false }: { state?: string; small?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={`assistant-orb ${small ? "small-orb" : ""}`} data-state={state} aria-hidden="true">
      <span className="orb-aura" />
      <svg viewBox="0 0 400 400" fill="none">
        <defs>
          <radialGradient id={`${id}-body`} cx="0.31" cy="0.24" r="0.82"><stop stopColor="#eee0ff" /><stop offset="0.16" stopColor="#c796ff" /><stop offset="0.44" stopColor="#8b3ce2" /><stop offset="0.76" stopColor="#4b1a8d" /><stop offset="1" stopColor="#180c30" /></radialGradient>
          <radialGradient id={`${id}-shine`} cx="0.33" cy="0.21" r="0.65"><stop stopColor="white" stopOpacity="0.65" /><stop offset="0.35" stopColor="#ead2ff" stopOpacity="0.1" /><stop offset="1" stopColor="#9852fd" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${id}-ring`} x1="80" y1="75" x2="320" y2="335" gradientUnits="userSpaceOnUse"><stop stopColor="#e7d7ff" stopOpacity="0.85" /><stop offset="0.25" stopColor="#9a58f7" stopOpacity="0.18" /><stop offset="0.66" stopColor="#a159ff" stopOpacity="0.6" /><stop offset="1" stopColor="#b48aff" stopOpacity="0.08" /></linearGradient>
          <filter id={`${id}-blur`}><feGaussianBlur stdDeviation="3" /></filter>
          <filter id={`${id}-grain`}><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <clipPath id={`${id}-clip`}><circle cx="200" cy="200" r="112" /></clipPath>
        </defs>
        <g className="orb-ring outer-ring"><ellipse cx="200" cy="200" rx="145" ry="151" stroke={`url(#${id}-ring)`} strokeWidth="8" opacity="0.38" filter={`url(#${id}-blur)`} /><ellipse cx="200" cy="200" rx="145" ry="151" stroke={`url(#${id}-ring)`} strokeWidth="3" strokeDasharray="230 130 150 430" /></g>
        <g className="orb-ring middle-ring"><ellipse cx="200" cy="200" rx="130" ry="135" stroke={`url(#${id}-ring)`} strokeWidth="6" strokeDasharray="130 210 160 340" opacity="0.75" /></g>
        <circle cx="200" cy="200" r="113" fill="#6c29b3" opacity="0.65" filter={`url(#${id}-blur)`} />
        <g className="orb-core"><circle cx="200" cy="200" r="112" fill={`url(#${id}-body)`} /><circle cx="200" cy="200" r="112" fill={`url(#${id}-shine)`} /><circle cx="200" cy="200" r="111.5" stroke="#d5acff" strokeOpacity="0.16" /><rect x="85" y="85" width="230" height="230" filter={`url(#${id}-grain)`} opacity="0.045" clipPath={`url(#${id}-clip)`} /></g>
        <g className="orb-ring inner-ring"><ellipse cx="200" cy="200" rx="121" ry="126" stroke={`url(#${id}-ring)`} strokeWidth="2" strokeDasharray="100 240 170 300" opacity="0.35" /></g>
      </svg>
    </span>
  );
}
