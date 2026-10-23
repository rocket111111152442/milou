export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M13.6 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3.1z" />
    </svg>
  );
}

/** Petite étoile à quatre branches (constellations). */
export function StarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="-10 -10 20 20" className={className} aria-hidden fill="currentColor">
      <path d="M0,-9Q1.2,-1.2 9,0Q1.2,1.2 0,9Q-1.2,1.2 -9,0Q-1.2,-1.2 0,-9Z" />
    </svg>
  );
}
