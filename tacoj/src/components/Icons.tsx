type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const PhoneIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>
);
export const PinIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);
export const ClockIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
);
export const ArrowIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M5 12h14M13 5l7 7-7 7"/></svg>
);
export const ArrowDownIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 5v14M5 13l7 7 7-7"/></svg>
);
export const DirectionsIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="m3 11 19-9-9 19-2-8-8-2Z"/></svg>
);
export const InstagramIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r="0.6" fill="currentColor"/></svg>
);
export const MenuIcon = ({ className = "h-6 w-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M3 7h18M3 12h18M3 17h18"/></svg>
);
export const CloseIcon = ({ className = "h-6 w-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M18 6 6 18M6 6l12 12"/></svg>
);
export const ExternalIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
);
