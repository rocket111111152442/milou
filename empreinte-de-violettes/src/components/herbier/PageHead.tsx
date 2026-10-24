import Link from "next/link";
import type { PlateName } from "@/lib/plates";
import { cn } from "@/lib/cn";
import { Fade, RunningHead, Words } from "./Elements";
import { Plate } from "./Plate";

/** En-tête des pages intérieures : titre courant, grand titre (avec une partie en italique), chapeau, gravure. */
export function PageHead({
  kicker,
  folio,
  title,
  accent,
  intro,
  plate,
  crumbs,
  children,
  className,
}: {
  kicker: string;
  folio?: string;
  title: string;
  accent?: string;
  intro?: string;
  plate?: PlateName;
  crumbs?: { href: string; label: string }[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("wrap pb-14 pt-28 sm:pt-32 lg:pb-20 lg:pt-40", className)}>
      <RunningHead left={kicker} right={folio} />
      {crumbs && (
        <nav aria-label="Fil d'Ariane" className="mt-4 font-text text-[0.88rem] italic text-ink-muted">
          <Link href="/" className="ulink">
            Accueil
          </Link>
          {crumbs.map((c) => (
            <span key={c.href}>
              {" "}
              /{" "}
              <Link href={c.href} className="ulink">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className={cn("mt-10 grid items-end gap-10 lg:mt-14", plate && "lg:grid-cols-[1.5fr_1fr]")}>
        <div>
          <h1 className="h-title">
            <Words text={title} />
            {accent && (
              <>
                {" "}
                <em className="text-plum">
                  <Words text={accent} delay={0.12} />
                </em>
              </>
            )}
          </h1>
          {intro && (
            <Fade delay={0.25}>
              <p className="body-text mt-8 max-w-2xl !text-[1.15rem] sm:!text-[1.22rem]">{intro}</p>
            </Fade>
          )}
          {children}
        </div>
        {plate && <Plate name={plate} reveal="mount" delay={0.2} duration={2} className="hidden w-[min(300px,80%)] justify-self-end text-plum lg:block" />}
      </div>
    </header>
  );
}
