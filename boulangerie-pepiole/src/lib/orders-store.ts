import "server-only";
import { del, get, list, put } from "@vercel/blob";
import type { ShopId } from "./shops";

// Commandes enregistrées dans le Blob store privé du projet (une commande = un fichier JSON).

export const ORDER_STATUSES = ["nouvelle", "prete", "retiree", "annulee"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type StoredOrder = {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  /** Commande passée alors que le site était en mode démonstration */
  demo: boolean;
  shop: ShopId;
  pickup: { date: string; time: string; label: string };
  customer: { firstName: string; lastName: string; phone: string; email: string; note: string };
  items: { id: string; name: string; unit: string | null; qty: number; unitPrice: number; total: number }[];
  total: number;
};

const PREFIX = "commandes/";

export function storageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function saveOrder(order: StoredOrder) {
  await put(`${PREFIX}${order.orderNumber}.json`, JSON.stringify(order), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

async function readOrder(pathname: string): Promise<StoredOrder | null> {
  const res = await get(pathname, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  try {
    return JSON.parse(await new Response(res.stream).text()) as StoredOrder;
  } catch {
    return null;
  }
}

/** Les commandes les plus récentes (300 max), de la plus récente à la plus ancienne. */
export async function listOrders(limit = 300): Promise<StoredOrder[]> {
  const blobs: { pathname: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
  const orders = await Promise.all(blobs.slice(0, limit).map((b) => readOrder(b.pathname)));
  return orders
    .filter((o): o is StoredOrder => o !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const ORDER_NUMBER = /^PP-\d{6}-[A-Z0-9]{4}$/;

/** Supprime définitivement une commande. */
export async function deleteOrder(orderNumber: string) {
  if (!ORDER_NUMBER.test(orderNumber)) throw new Error("Numéro de commande invalide");
  await del(`${PREFIX}${orderNumber}.json`);
}

/** Supprime tous les fichiers d'un dossier du Blob store ; renvoie le nombre de fichiers supprimés. */
export async function wipePrefix(prefix: string) {
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url));
    count += page.blobs.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}

export async function setOrderStatus(orderNumber: string, status: OrderStatus) {
  if (!ORDER_NUMBER.test(orderNumber)) throw new Error("Numéro de commande invalide");
  const order = await readOrder(`${PREFIX}${orderNumber}.json`);
  if (!order) throw new Error("Commande introuvable");
  await saveOrder({ ...order, status });
}
