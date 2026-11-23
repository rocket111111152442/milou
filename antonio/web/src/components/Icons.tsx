import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const Icon = {
  Spark: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1" /></svg>
  ),
  Sun: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  ),
  Inbox: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></svg>
  ),
  Calendar: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 3v3M8 3v3M3 10h18" /></svg>
  ),
  Check: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>
  ),
  Tasks: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></svg>
  ),
  Shield: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
  ),
  History: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
  ),
  Template: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></svg>
  ),
  Rule: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 6h10M4 12h16M4 18h7" /><circle cx="17" cy="6" r="2" /><circle cx="14" cy="18" r="2" /></svg>
  ),
  Plug: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0z" /><path d="M12 18v4" /></svg>
  ),
  User: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
  ),
  Gauge: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 14l4-4" /><path d="M3.3 17a10 10 0 1 1 17.4 0" /></svg>
  ),
  Mic: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></svg>
  ),
  MicOff: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="m3 3 18 18" /><path d="M9 9v1a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.7-1.3" /><path d="M19 10a7 7 0 0 1-1.1 3.8M5 10a7 7 0 0 0 10.7 5.9M12 17v4M8 21h8" /></svg>
  ),
  Send: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>
  ),
  Close: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  Menu: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
  ),
  Trash: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
  ),
  Archive: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></svg>
  ),
  Restore: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
  ),
  Paperclip: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="m21 12-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8" /></svg>
  ),
  Alert: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
  ),
  Video: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4z" /></svg>
  ),
  Edit: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
  ),
};
