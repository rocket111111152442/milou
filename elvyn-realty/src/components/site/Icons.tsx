import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconBed = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M3 18v2M21 18v2M7 9V6h4v3" /></svg>);
export const IconBath = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3ZM6 12V5a2 2 0 0 1 4 0M7 20l-1 2M17 20l1 2" /></svg>);
export const IconArea = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 4h16v16H4zM4 9h5V4M20 15h-5v5" /></svg>);
export const IconCar = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM7 19v2M17 19v2M7 13h.01M17 13h.01" /></svg>);
export const IconPin = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>);
export const IconPhone = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>);
export const IconMail = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>);
export const IconSearch = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconClose = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconMenu = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const IconChevronLeft = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m15 18-6-6 6-6" /></svg>);
export const IconChevronRight = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m9 18 6-6-6-6" /></svg>);
export const IconArrowRight = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconFilter = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 6h16M7 12h10M10 18h4" /></svg>);
export const IconCheck = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m5 12 5 5 9-10" /></svg>);
export const IconCalendar = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>);
export const IconPlay = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4z" /></svg>);
export const IconImages = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="5" width="15" height="13" rx="2" /><path d="M7 21h12a2 2 0 0 0 2-2V8M3 15l4-4 4 4 3-3 4 4" /></svg>);
export const IconChat = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></svg>);
export const IconSend = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 12 20 4l-6 16-3-7-7-1Z" /></svg>);
export const IconUser = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
export const IconHome = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m3 11 9-7 9 7M5 10v10h14V10" /></svg>);
export const IconKey = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></svg>);
export const IconBuilding = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 21V5l8-2v18M12 8h8v13M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01M2 21h20" /></svg>);
export const IconTag = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>);
export const IconGlobe = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>);
export const IconShield = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>);
export const IconVideo = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg>);
export const IconWhatsApp = ({ size = 20, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.4A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7 3.9Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z" />
  </svg>
);
export const IconInstagram = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></svg>);
export const IconFacebook = ({ size = 20, ...p }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8.5c0-.3.2-.5.5-.5Z" /></svg>);
export const IconYoutube = ({ size = 20, ...p }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" /></svg>);
export const IconLinkedin = ({ size = 20, ...p }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M5 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2 6h4v12H3V9Zm7 0h3.8v1.7h.1A4.2 4.2 0 0 1 17.7 9c4 0 4.8 2.6 4.8 6.1V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9Z" /></svg>);
