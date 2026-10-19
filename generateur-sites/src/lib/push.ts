import "server-only";
import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { getJSON, listEntries, putJSON, removeFile, storageEnabled } from "./store";
import type { ShopId } from "./shops";
import { formatDateLong, formatTime } from "./hours";
import type { StoredOrder } from "./orders-store";

// Notifications push vers les téléphones / ordinateurs des boutiques (abonnements dans le Blob privé).

const prefix = (slug: string) => `t/${slug}/push/`;

export type PushDevice = {
  subscription: PushSubscription;
  /** Boutiques suivies par cet appareil */
  shops: ShopId[];
  label: string;
  createdAt: string;
};

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && storageEnabled());
}

function setup() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "mailto:contact@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

const keyOf = (slug: string, endpoint: string) => `${prefix(slug)}${createHash("sha256").update(endpoint).digest("hex").slice(0, 32)}.json`;

export async function saveDevice(slug: string, device: PushDevice) {
  await putJSON(keyOf(slug, device.subscription.endpoint), device);
}

export async function removeDevice(slug: string, endpoint: string) {
  await removeFile(keyOf(slug, endpoint)).catch(() => {});
}

async function listDevices(slug: string) {
  const entries = await listEntries(prefix(slug));
  const devices = await Promise.all(entries.map((e) => getJSON<PushDevice>(e.pathname)));
  return devices.filter((d): d is PushDevice => d !== null);
}

export async function countDevices(slug: string) {
  if (!pushConfigured()) return 0;
  return (await listEntries(prefix(slug))).length;
}

async function send(slug: string, payload: object, shop: ShopId | null) {
  if (!pushConfigured()) return { sent: 0 };
  setup();
  const devices = (await listDevices(slug)).filter((d) => !shop || d.shops.includes(shop));
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    devices.map(async (d) => {
      try {
        await webpush.sendNotification(d.subscription, body, { TTL: 60 * 60 * 12, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // Abonnement expiré ou révoqué : on l'oublie
        if (code === 404 || code === 410) await removeDevice(slug, d.subscription.endpoint);
        else console.warn("[push] échec", code, (e as Error).message);
      }
    }),
  );
  return { sent };
}

export async function notifyNewOrder(slug: string, shopShort: string, order: StoredOrder) {
  const count = order.items.reduce((n, i) => n + i.qty, 0);
  return send(
    slug,
    {
      title: `${order.demo ? "[Test] " : ""}Nouvelle commande · ${shopShort}`,
      body: `${order.customer.firstName} ${order.customer.lastName} — ${count} article${count > 1 ? "s" : ""}, retrait ${formatDateLong(order.pickup.date)} à ${formatTime(order.pickup.time)}`,
      url: `/s/${slug}/admin`,
      icon: `/s/${slug}/app-icon`,
      tag: order.orderNumber,
    },
    order.shop,
  );
}

export async function notifyTest(slug: string, shop: ShopId | null) {
  return send(slug, { title: "Notifications activées ✓", body: "Vous serez prévenu à chaque nouvelle commande.", url: `/s/${slug}/admin`, icon: `/s/${slug}/app-icon`, tag: "test" }, shop);
}
