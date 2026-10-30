import Link from "next/link";
import type { RenderLink } from "@waverti/ui/app";

/** Adaptateur next/link pour les vues partagées (@waverti/ui/app). */
export const NextLink: RenderLink = ({ href, className, children, onClick, ...rest }) => (
  <Link href={href} className={className} onClick={onClick} aria-current={rest["aria-current"]}>
    {children}
  </Link>
);
