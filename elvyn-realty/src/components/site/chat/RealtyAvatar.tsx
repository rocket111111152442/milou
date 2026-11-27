/**
 * "Realty", the assistant's mascot: a friendly little house (original drawing, brand colours).
 * Its eyes blink now and then (disabled for visitors who reduce motion).
 */
export function RealtyAvatar({ size = 40, className = "", ring = false }: { size?: number; className?: string; ring?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Realty" className={className}>
      {ring && <circle cx="32" cy="32" r="31" fill="#FFF7ED" stroke="#EB6500" strokeWidth="2" />}
      {/* chimney */}
      <rect x="41" y="12" width="6" height="11" rx="1.5" fill="#A04300" />
      {/* roof */}
      <path d="M8 31 L32 11 L56 31" fill="#EB6500" stroke="#EB6500" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      {/* body */}
      <rect x="14" y="28" width="36" height="27" rx="7" fill="#102632" />
      {/* eyes (windows) */}
      <g className="realty-eye">
        <ellipse cx="25" cy="38" rx="5" ry="5.5" fill="#FFFFFF" />
        <circle cx="26" cy="38.5" r="2.4" fill="#102632" />
        <circle cx="26.8" cy="37.4" r="0.9" fill="#FFFFFF" />
      </g>
      <g className="realty-eye">
        <ellipse cx="39" cy="38" rx="5" ry="5.5" fill="#FFFFFF" />
        <circle cx="40" cy="38.5" r="2.4" fill="#102632" />
        <circle cx="40.8" cy="37.4" r="0.9" fill="#FFFFFF" />
      </g>
      {/* cheeks */}
      <circle cx="20" cy="46" r="2.3" fill="#EB6500" opacity=".55" />
      <circle cx="44" cy="46" r="2.3" fill="#EB6500" opacity=".55" />
      {/* smile */}
      <path d="M27 46.5 Q32 51 37 46.5" fill="none" stroke="#FFD3A8" strokeWidth="2.2" strokeLinecap="round" />
      {/* little key in hand */}
      <g transform="translate(50 44) rotate(-30)">
        <circle cx="0" cy="0" r="3.2" fill="none" stroke="#FFD3A8" strokeWidth="2" />
        <path d="M3 0 H10 M7.5 0 V3 M9.5 0 V2.4" stroke="#FFD3A8" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
