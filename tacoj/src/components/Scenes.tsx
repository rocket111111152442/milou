/**
 * Illustrated scene artwork used until Taco J's own photos are added.
 * Pure SVG: zero network cost, crisp on every screen.
 */

export function SunsetScene({ className = "", id = "s" }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB13B" />
          <stop offset=".45" stopColor="#FF6B2C" />
          <stop offset=".75" stopColor="#E2501A" />
        </linearGradient>
        <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF1B8" />
          <stop offset="1" stopColor="#FFC233" />
        </linearGradient>
        <clipPath id={`${id}-sunclip`}>
          <rect x="0" y="0" width="800" height="232" />
          <rect x="0" y="244" width="800" height="12" />
          <rect x="0" y="266" width="800" height="10" />
          <rect x="0" y="286" width="800" height="7" />
          <rect x="0" y="302" width="800" height="5" />
        </clipPath>
      </defs>
      <rect width="800" height="600" fill={`url(#${id}-sky)`} />
      <circle cx="430" cy="300" r="150" fill={`url(#${id}-sun)`} clipPath={`url(#${id}-sunclip)`} />
      {/* sea */}
      <rect y="320" width="800" height="280" fill="#0A5D63" />
      <path d="M0 320h800v14c-40 6-80-6-120 0s-80 8-120 2-80-8-120 0-80 6-120 0-80-8-120-2-80 6-200-6Z" fill="#0E8A8C" />
      <g stroke="#FFC233" strokeWidth="5" strokeLinecap="round" opacity=".85">
        <path d="M360 350h140M380 372h100M398 392h64M412 410h36" />
      </g>
      <g stroke="#3FE0D0" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".45">
        <path d="M40 380c20-8 40 8 60 0s40 8 60 0M600 400c20-8 40 8 60 0s40 8 60 0M120 440c20-8 40 8 60 0s40 8 60 0M560 460c20-8 40 8 60 0" />
      </g>
      {/* sand */}
      <path d="M0 470c120-30 260-36 400-18s260 4 400-24v172H0Z" fill="#F2C987" />
      <path d="M0 510c140-24 300-20 440-4s240 6 360-12v106H0Z" fill="#EEDCBB" />
      {/* palm */}
      <g fill="#1B1614">
        <path d="M118 540c6-90 18-170 52-250l10 4c-30 78-42 160-46 246Z" />
        <path d="M176 292c-40-30-98-30-140 4 46-12 92-6 134 8Z" />
        <path d="M176 292c-10-46-50-80-104-86 40 20 70 50 92 92Z" />
        <path d="M176 292c30-40 84-58 136-44-48 4-92 24-124 56Z" />
        <path d="M176 292c46-6 92 18 116 62-34-30-74-46-118-48Z" />
        <path d="M176 292c-8-40 4-84 34-112-14 36-18 74-14 110Z" />
      </g>
      {/* surfboard */}
      <g transform="rotate(14 650 470)">
        <ellipse cx="650" cy="440" rx="26" ry="120" fill="#F7EBD5" stroke="#1B1614" strokeWidth="6" />
        <path d="M650 322v236" stroke="#D42A1E" strokeWidth="8" />
      </g>
      {/* birds */}
      <g stroke="#1B1614" strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M560 140q10-10 20 0q10-10 20 0" />
        <path d="M610 110q7-7 14 0q7-7 14 0" />
      </g>
    </svg>
  );
}

export function NightScene({ className = "", id = "n" }: { className?: string; id?: string }) {
  const windows: { x: number; y: number; c: string }[] = [];
  const buildings = [
    { x: 0, w: 90, h: 230 }, { x: 96, w: 70, h: 300 }, { x: 172, w: 110, h: 190 }, { x: 290, w: 80, h: 340 },
    { x: 376, w: 120, h: 250 }, { x: 502, w: 74, h: 310 }, { x: 582, w: 104, h: 210 }, { x: 692, w: 108, h: 280 },
  ];
  buildings.forEach((b, bi) => {
    for (let yy = 600 - b.h + 24; yy < 560; yy += 28) {
      for (let xx = b.x + 14; xx < b.x + b.w - 14; xx += 22) {
        const seed = (xx * 7 + yy * 13 + bi * 31) % 11;
        if (seed < 4) windows.push({ x: xx, y: yy, c: seed === 0 ? "#3FE0D0" : seed === 1 ? "#F0503F" : "#FFC233" });
      }
    }
  });
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E0B0A" />
          <stop offset=".6" stopColor="#251E1B" />
          <stop offset="1" stopColor="#3A1712" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx=".5" cy=".9" r=".7">
          <stop offset="0" stopColor="#D42A1E" stopOpacity=".55" />
          <stop offset="1" stopColor="#D42A1E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill={`url(#${id}-sky)`} />
      <rect width="800" height="600" fill={`url(#${id}-glow)`} />
      <g fill="#F7EBD5">
        {[[80, 60], [210, 120], [330, 40], [470, 90], [620, 50], [720, 140], [40, 170], [560, 160]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" opacity=".7" />
        ))}
      </g>
      <circle cx="660" cy="110" r="38" fill="#F7EBD5" opacity=".9" />
      <circle cx="676" cy="100" r="34" fill="#0E0B0A" opacity=".95" />
      <g fill="#120E0D">
        {buildings.map((b) => <rect key={b.x} x={b.x} y={600 - b.h} width={b.w} height={b.h} />)}
      </g>
      <g>
        {windows.map((w) => <rect key={`${w.x}-${w.y}`} x={w.x} y={w.y} width="9" height="12" fill={w.c} opacity=".85" />)}
      </g>
      <rect y="560" width="800" height="40" fill="#0A0807" />
      <g stroke="#F0503F" strokeWidth="3" opacity=".6">
        <path d="M0 572h800" strokeDasharray="30 22" />
      </g>
    </svg>
  );
}
