import { cn } from "../lib/cn";

/**
 * Marque Waverti (le « W »). Image servie par chaque application à l'adresse /brand/waverti-mark.png
 * (site web et application desktop), identique aux icônes d'application.
 */
export function LogoMark({ className, title, src = "/brand/waverti-mark.png" }: { className?: string; title?: string; src?: string }) {
  return (
    <img
      src={src}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      width={64}
      height={64}
      decoding="async"
      className={cn("size-8 shrink-0 select-none", className)}
      draggable={false}
    />
  );
}

export function Logo({ className, markClassName, light }: { className?: string; markClassName?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className={cn("font-display text-[19px] font-bold tracking-[-0.03em]", light ? "text-white" : "text-ink")}>Waverti</span>
    </span>
  );
}
