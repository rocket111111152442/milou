/** Round badge with text turning around a centre mark. */
export function SpinBadge({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div aria-hidden className={`h-32 w-32 sm:h-36 sm:w-36 ${className || "relative"}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-spin-slow motion-reduce:animate-none">
        <defs>
          <path id="spin-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <circle cx="100" cy="100" r="98" fill="#102632" />
        <text fill="#FFFFFF" fontSize="17" fontWeight="700" letterSpacing="5.2">
          <textPath href="#spin-circle">{text}</textPath>
        </text>
      </svg>
      <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </span>
    </div>
  );
}
