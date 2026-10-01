import type { MenuItem } from "@/data/site";

/**
 * Branded poster-style placeholder artwork, shown when a menu item has no photo yet.
 * Replace by setting `image` on the item in src/data/site.ts.
 */
const S = "#1B1614"; // outline
const sw = 6;

const shapes: Record<MenuItem["art"], React.ReactNode> = {
  taco: (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M38 98c10-16 28-18 38-8 8-14 30-16 40-4 10-12 32-10 40 6 10-2 18 2 20 6" fill="#3E9B4F" stroke={S} strokeWidth={sw} />
      <circle cx="70" cy="90" r="9" fill="#D42A1E" stroke={S} strokeWidth={5} />
      <circle cx="122" cy="86" r="9" fill="#D42A1E" stroke={S} strokeWidth={5} />
      <path d="M52 100c14-8 30-6 42 0 12-8 34-8 48 0 8-4 18-4 26 2" fill="#8A3B1C" stroke={S} strokeWidth={sw} />
      <path d="M26 104h150a75 70 0 0 1-150 0Z" fill="#FFC233" stroke={S} strokeWidth={sw} />
      <path d="M52 128c4 6 10 10 16 12M140 132c-4 4-8 7-12 8" stroke={S} strokeWidth={4} fill="none" opacity=".5" />
      <circle cx="96" cy="140" r="3" fill={S} opacity=".35" /><circle cx="116" cy="150" r="3" fill={S} opacity=".35" /><circle cx="76" cy="152" r="3" fill={S} opacity=".35" />
    </g>
  ),
  burrito: (
    <g strokeLinejoin="round" transform="rotate(-28 100 100)">
      <rect x="48" y="58" width="104" height="96" rx="40" fill="#F7EBD5" stroke={S} strokeWidth={sw} />
      <path d="M48 104h104v10c0 22-18 40-40 40H88c-22 0-40-18-40-40Z" fill="#C9CED1" stroke={S} strokeWidth={sw} />
      <path d="M60 116l12 10 12-10 12 10 12-10 12 10 12-10 8 6" fill="none" stroke={S} strokeWidth={4} opacity=".45" />
      <ellipse cx="100" cy="62" rx="44" ry="16" fill="#8A3B1C" stroke={S} strokeWidth={sw} />
      <circle cx="84" cy="60" r="6" fill="#D42A1E" /><circle cx="110" cy="58" r="6" fill="#3E9B4F" /><circle cx="120" cy="66" r="5" fill="#FFC233" />
    </g>
  ),
  quesadilla: (
    <g strokeLinejoin="round">
      <path d="M30 120a70 70 0 0 1 140 0Z" fill="#FFC233" stroke={S} strokeWidth={sw} />
      <path d="M100 120 52 72M100 120l48-48M100 120V50" stroke={S} strokeWidth={5} />
      <path d="M44 120c2 10 8 12 10 4 2 12 12 14 14 2 4 10 12 10 14 0 4 14 14 14 16 2 4 10 12 10 14-2 4 10 14 8 14-2 4 8 12 6 12-4" fill="#FFE07A" stroke={S} strokeWidth={5} />
      <circle cx="78" cy="96" r="3.5" fill={S} opacity=".35" /><circle cx="124" cy="98" r="3.5" fill={S} opacity=".35" /><circle cx="100" cy="76" r="3.5" fill={S} opacity=".35" />
    </g>
  ),
  nachos: (
    <g strokeLinejoin="round">
      <path d="M40 150 70 70l40 70Z" fill="#FFC233" stroke={S} strokeWidth={sw} />
      <path d="M86 156 120 64l40 86Z" fill="#FFB020" stroke={S} strokeWidth={sw} />
      <path d="M60 158 96 96l36 62Z" fill="#FFD25A" stroke={S} strokeWidth={sw} />
      <path d="M56 116c10-6 20 8 30 0s18 10 28 2 18 6 26-2 14 4 20 2c0 8-6 10-10 6-2 12-10 12-12 2-4 10-12 10-14 0-4 12-14 12-16 0-4 8-12 8-14-2-4 8-12 8-14-4-2 4-6 4-4-4Z" fill="#FF6B2C" stroke={S} strokeWidth={5} />
      <circle cx="80" cy="132" r="7" fill="#3E9B4F" stroke={S} strokeWidth={4} /><circle cx="128" cy="128" r="7" fill="#D42A1E" stroke={S} strokeWidth={4} />
    </g>
  ),
  corn: (
    <g strokeLinejoin="round" transform="rotate(-35 100 100)">
      <path d="M100 168c-20-10-30-40-26-66-12 18-18 46-8 70Z" fill="#3E9B4F" stroke={S} strokeWidth={sw} />
      <path d="M100 168c20-10 30-40 26-66 12 18 18 46 8 70Z" fill="#2F7D3E" stroke={S} strokeWidth={sw} />
      <rect x="78" y="34" width="44" height="120" rx="22" fill="#FFC233" stroke={S} strokeWidth={sw} />
      {[52, 70, 88, 106, 124].map((y) => (
        <g key={y}><circle cx="92" cy={y} r="5" fill="#F2A900" /><circle cx="108" cy={y} r="5" fill="#F2A900" /></g>
      ))}
      <path d="M80 60c8 6 32 6 40 0M80 96c8 6 32 6 40 0" stroke="#F7EBD5" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M86 78l4 4M110 116l4 4M96 132l3 3" stroke="#D42A1E" strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  sticks: (
    <g strokeLinejoin="round">
      <rect x="40" y="92" width="120" height="26" rx="13" fill="#F2A900" stroke={S} strokeWidth={sw} transform="rotate(-18 100 105)" />
      <rect x="40" y="108" width="120" height="26" rx="13" fill="#FFC233" stroke={S} strokeWidth={sw} transform="rotate(10 100 121)" />
      <rect x="48" y="72" width="104" height="26" rx="13" fill="#FFB020" stroke={S} strokeWidth={sw} transform="rotate(4 100 85)" />
      <path d="M138 52c10 0 18 8 16 18-2 6-8 8-12 6-6-2-6-10-4-24Z" fill="#3E9B4F" stroke={S} strokeWidth={5} />
      <path d="M140 52c0-6 2-10 6-12" stroke={S} strokeWidth={5} fill="none" strokeLinecap="round" />
    </g>
  ),
  fries: (
    <g strokeLinejoin="round">
      {[68, 82, 96, 110, 124].map((x, i) => (
        <rect key={x} x={x} y={46 + (i % 2) * 12} width="14" height="80" rx="3" fill="#FFC233" stroke={S} strokeWidth={5} transform={`rotate(${(i - 2) * 6} ${x + 7} 120)`} />
      ))}
      <path d="M58 90c14 8 28-4 42 4s30-6 44 0" fill="none" stroke="#8A3B1C" strokeWidth={9} strokeLinecap="round" />
      <path d="M56 96h88l-10 70H66Z" fill="#D42A1E" stroke={S} strokeWidth={sw} />
      <path d="M78 120h44" stroke="#F7EBD5" strokeWidth={6} strokeLinecap="round" />
    </g>
  ),
  churro: (
    <g strokeLinejoin="round">
      <rect x="74" y="34" width="20" height="120" rx="8" fill="#E2933F" stroke={S} strokeWidth={sw} transform="rotate(-14 84 94)" />
      <rect x="104" y="40" width="20" height="116" rx="8" fill="#D88432" stroke={S} strokeWidth={sw} transform="rotate(12 114 98)" />
      <path d="M80 50l-2 90M108 52l6 90" stroke={S} strokeWidth={3} opacity=".35" />
      <circle cx="80" cy="64" r="2.5" fill="#F7EBD5" /><circle cx="86" cy="90" r="2.5" fill="#F7EBD5" /><circle cx="114" cy="70" r="2.5" fill="#F7EBD5" /><circle cx="118" cy="98" r="2.5" fill="#F7EBD5" />
      <path d="M62 120h76l-8 44H70Z" fill="#0E8A8C" stroke={S} strokeWidth={sw} />
      <path d="M62 120h76" stroke={S} strokeWidth={sw} />
      <path d="M78 140h44" stroke="#F7EBD5" strokeWidth={5} strokeLinecap="round" />
    </g>
  ),
  drink: (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M118 40 104 104" stroke={S} strokeWidth={sw} />
      <path d="M118 40l12-6" stroke={S} strokeWidth={sw} />
      <path d="M52 70h96l-36 46v32h22v12H66v-12h22v-32Z" fill="#F7EBD5" stroke={S} strokeWidth={sw} />
      <path d="M64 80h72l-28 32H92Z" fill="#FF6B2C" />
      <circle cx="140" cy="70" r="18" fill="#B8E04A" stroke={S} strokeWidth={sw} />
      <path d="M140 56v28M126 70h28M130 60l20 20M150 60l-20 20" stroke="#3E9B4F" strokeWidth={3} />
    </g>
  ),
};

const bgs: Record<MenuItem["art"], string> = {
  taco: "#D42A1E",
  burrito: "#0E8A8C",
  quesadilla: "#FF6B2C",
  nachos: "#0A5D63",
  corn: "#D42A1E",
  sticks: "#FF6B2C",
  fries: "#FFC233",
  churro: "#F7EBD5",
  drink: "#1B1614",
};

const variants = ["#D42A1E", "#0E8A8C", "#FF6B2C", "#0A5D63", "#1B1614", "#FFC233"];

export default function FoodArt({ art, className = "", variant }: { art: MenuItem["art"]; className?: string; variant?: number }) {
  const bg = variant === undefined ? bgs[art] : variants[variant % variants.length];
  const light = bg === "#FFC233" || bg === "#F7EBD5";
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Illustration placeholder — photo coming soon">
      <rect width="200" height="200" fill={bg} />
      <g opacity={light ? 0.18 : 0.14} stroke={light ? "#1B1614" : "#F7EBD5"} strokeWidth="10">
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1="100" y1="100" x2={100 + 160 * Math.cos((i * Math.PI) / 6)} y2={100 + 160 * Math.sin((i * Math.PI) / 6)} />
        ))}
      </g>
      <circle cx="100" cy="104" r="70" fill={light ? "#FFF6E6" : "#1B1614"} opacity={light ? 0.6 : 0.18} />
      {shapes[art]}
    </svg>
  );
}
