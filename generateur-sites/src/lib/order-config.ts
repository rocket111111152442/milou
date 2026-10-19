import "server-only";
import type { Settings } from "./settings";
import type { Shop } from "./shops";
import type { TenantConfig } from "./tenant";
import { storageEnabled } from "./store";

/** Adresse(s) qui reçoivent les commandes d'une boutique : celle de la boutique, sinon celle du site. */
export function orderEmailTo(tenant: Pick<TenantConfig, "orderEmail">, shop: Pick<Shop, "orderEmail">) {
  return shop.orderEmail || tenant.orderEmail || "";
}

/**
 * Vrai quand les commandes de cette boutique sont réellement traitées : interrupteur « En service »
 * dans l'/admin du site, ou e-mail de réception configuré (avec RESEND_API_KEY).
 * Sinon : mode démonstration (la commande est enregistrée mais marquée « Test »).
 */
export function ordersEnabled(tenant: Pick<TenantConfig, "orderEmail">, shop: Shop, settings?: Settings) {
  return Boolean((process.env.RESEND_API_KEY && orderEmailTo(tenant, shop)) || (storageEnabled() && settings?.live[shop.id] === true));
}
