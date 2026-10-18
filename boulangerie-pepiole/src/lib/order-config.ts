import "server-only";
import type { ShopId } from "./shops";

/** Adresse(s) qui reçoivent les commandes d'une boutique : ORDER_EMAIL_TO_SANARY, ORDER_EMAIL_TO_SIX_FOURS… sinon ORDER_EMAIL_TO. */
export function orderEmailTo(shop: ShopId) {
  const key = `ORDER_EMAIL_TO_${shop.toUpperCase().replace(/-/g, "_")}`;
  return process.env[key] || process.env.ORDER_EMAIL_TO || "";
}

/**
 * Vrai quand les commandes de cette boutique sont réellement traitées :
 * e-mail ou webhook configuré, ou ORDERS_LIVE=1 (la boutique suit les commandes dans /admin).
 */
export function ordersEnabled(shop: ShopId) {
  return Boolean(
    (process.env.RESEND_API_KEY && orderEmailTo(shop)) ||
      process.env.ORDER_WEBHOOK_URL ||
      (process.env.ORDERS_LIVE === "1" && process.env.BLOB_READ_WRITE_TOKEN),
  );
}
