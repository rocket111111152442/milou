import "server-only";

/** Vrai dès qu'un canal de transmission des commandes est configuré. */
export function ordersEnabled() {
  return Boolean(
    (process.env.RESEND_API_KEY && process.env.ORDER_EMAIL_TO) || process.env.ORDER_WEBHOOK_URL,
  );
}
