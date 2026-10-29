import { cn } from "../lib/cn";

export function Spinner({ className, label = "Chargement" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-block size-5", className)}>
      <svg viewBox="0 0 24 24" className="size-full animate-spin motion-reduce:animate-none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
