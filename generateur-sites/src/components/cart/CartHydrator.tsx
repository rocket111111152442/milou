"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { useSiteData } from "@/components/SettingsProvider";

/** Réhydrate le panier après le montage ; chaque site a son propre panier. */
export function CartHydrator() {
  const { slug } = useSiteData();
  useEffect(() => {
    useCart.setState({ lines: [], shop: null });
    useCart.persist.setOptions({ name: `panier-${slug}` });
    useCart.persist.rehydrate();
  }, [slug]);
  return null;
}
