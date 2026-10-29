import type * as React from "react";

export type RenderLink = (props: {
  href: string;
  className?: string;
  children: React.ReactNode;
  "aria-current"?: "page";
  onClick?: () => void;
}) => React.ReactNode;

/** Lien par défaut (balise <a>) ; le web injecte next/link, le desktop son propre routeur. */
export const defaultRenderLink: RenderLink = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);
