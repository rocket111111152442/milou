import "server-only";
import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { dbEnabled, query } from "./db";
import { getShop, type ShopId } from "./shops";
import { formatDateLong, formatTime } from "./hours";
import type { StoredOrder } from "./orders-store";

// Notifications push vers les téléphones / ordinateurs des boutiques (abonnements dans Postgres, table petrin_push_devices).

export type PushDevice = {
  subscription: PushSubscription;
  /** Boutiques suivies par cet appareil */
  shops: ShopId[];
  label: string;
  createdAt: string;
};

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && dbEnabled());
}

function setup() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://petrin-de-pepiole.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

const keyOf = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

export async function saveDevice(device: PushDevice) {
  await query(
    `insert into petrin_push_devices (key, data) values ($1, $2)
     on conflict (key) do update set data = excluded.data`,
    [keyOf(device.subscription.endpoint), JSON.stringify(device)],
  );
}

export async function removeDevice(endpoint: string) {
  await query("delete from petrin_push_devices where key = $1", [keyOf(endpoint)]).catch(() => {});
}

async function listDevices() {
  const { rows } = await query<{ data: PushDevice }>("select data from petrin_push_devices");
  return rows.map((r) => r.data);
}

export async function countDevices() {
  if (!pushConfigured()) return 0;
  const { rows } = await query<{ n: string }>("select count(*) as n from petrin_push_devices");
  return Number(rows[0]?.n ?? 0);
}

/** Supprime tous les appareils abonnés ; renvoie leur nombre. */
export async function wipeDevices() {
  const { rowCount } = await query("delete from petrin_push_devices");
  return rowCount ?? 0;
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
