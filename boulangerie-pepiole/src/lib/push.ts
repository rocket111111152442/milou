import "server-only";
import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { del, get, list, put } from "@vercel/blob";
import { getShop, type ShopId } from "./shops";
import { formatDateLong, formatTime } from "./hours";
import type { StoredOrder } from "./orders-store";

// Notifications push vers les téléphones / ordinateurs des boutiques (abonnements dans le Blob privé).

const PREFIX = "push/";

export type PushDevice = {
  subscription: PushSubscription;
  /** Boutiques suivies par cet appareil */
  shops: ShopId[];
  label: string;
  createdAt: string;
};

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.BLOB_READ_WRITE_TOKEN);
}

function setup() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://petrin-de-pepiole.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

const keyOf = (endpoint: string) => `${PREFIX}${createHash("sha256").update(endpoint).digest("hex").slice(0, 32)}.json`;

export async function saveDevice(device: PushDevice) {
  await put(keyOf(device.subscription.endpoint), JSON.stringify(device), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function removeDevice(endpoint: string) {
  await del(keyOf(endpoint)).catch(() => {});
}

async function listDevices() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  const devices = await Promise.all(
    blobs.map(async (b) => {
      const res = await get(b.pathname, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      try {
        return JSON.parse(await new Response(res.stream).text()) as PushDevice;
      } catch {
        return null;
      }
    }),
  );
  return devices.filter((d): d is PushDevice => d !== null);
}

export async function countDevices() {
  if (!pushConfigured()) return 0;
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  return blobs.length;
}

async function send(payload: object, shop: ShopId | null) {
  if (!pushConfigured()) return { sent: 0 };
  setup();
  const devices = (await listDevices()).filter((d) => !shop || d.shops.includes(shop));
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
        if (code === 404 || code === 410) await removeDevice(d.subscription.endpoint);
        else console.warn("[push] échec", code, (e as Error).message);
      }
    }),
  );
  return { sent };
}

export async function notifyNewOrder(order: StoredOrder) {
  const shop = getShop(order.shop);
  const count = order.items.reduce((n, i) => n + i.qty, 0);
  return send(
    {
      title: `${order.demo ? "[Test] " : ""}Nouvelle commande · ${shop.short}`,
      body: `${order.customer.firstName} ${order.customer.lastName} — ${count} article${count > 1 ? "s" : ""}, retrait ${formatDateLong(order.pickup.date)} à ${formatTime(order.pickup.time)}`,
      url: "/admin",
      tag: order.orderNumber,
    },
    order.shop,
  );
}

export async function notifyTest(shop: ShopId | null) {
  return send({ title: "Notifications activées ✓", body: "Vous serez prévenu à chaque nouvelle commande.", url: "/admin", tag: "test" }, shop);
}
