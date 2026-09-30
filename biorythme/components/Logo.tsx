export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display inline-flex items-center gap-2 text-2xl ${className}`}>
      <svg viewBox="0 0 40 24" className="h-5 w-auto" aria-hidden>
        <path
          d="M0 12h8l3-8 5 16 5-12 3 4h16"
          fill="none"
          stroke="var(--color-volt)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Biorythme
    </span>
  );
}
