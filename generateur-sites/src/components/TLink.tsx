"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useSiteData } from "@/components/SettingsProvider";

/** Lien interne d'un site généré : ajoute automatiquement le préfixe /s/<slug>. */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const { base } = useSiteData();
  const h = typeof href === "string" && href.startsWith("/") ? `${base}${href === "/" ? "" : href}` : href;
  return <NextLink href={h || "/"} {...props} />;
}

/** Chemin de la page sans le préfixe du site : « / », « /carte », « /admin/reglages »… */
export function useSitePath() {
  const { base } = useSiteData();
  const path = usePathname();
  return path.startsWith(base) ? path.slice(base.length) || "/" : path;
}

/** Adresse interne d'un site généré (pour router.push, <a>, fetch…). */
export function useHref() {
  const { base } = useSiteData();
  return (path: string) => `${base}${path === "/" ? "" : path}`;
}
