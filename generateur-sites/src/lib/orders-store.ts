import "server-only";
import { getJSON, listEntries, putJSON, removeFile, storageEnabled } from "./store";
import type { ShopId } from "./shops";

// Commandes d'un site (une commande = un fichier JSON, dans le dossier du site).

export { storageEnabled };

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
  items: { id: string; name: string; unit: string | null; options?: string | null; qty: number; unitPrice: number; total: number }[];
  total: number;
};

const prefix = (slug: string) => `t/${slug}/commandes/`;
const ORDER_NUMBER = /^PP-\d{6}-[A-Z0-9]{4}$/;

export async function saveOrder(slug: string, order: StoredOrder) {
  await putJSON(`${prefix(slug)}${order.orderNumber}.json`, order);
}

/** Les commandes les plus récentes (300 max), de la plus récente à la plus ancienne. */
export async function listOrders(slug: string, limit = 300): Promise<StoredOrder[]> {
  const entries = (await listEntries(prefix(slug))).sort((a, b) => +b.uploadedAt - +a.uploadedAt);
  const orders = await Promise.all(entries.slice(0, limit).map((e) => getJSON<StoredOrder>(e.pathname)));
  return orders.filter((o): o is StoredOrder => o !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Supprime définitivement une commande. */
export async function deleteOrder(slug: string, orderNumber: string) {
  if (!ORDER_NUMBER.test(orderNumber)) throw new Error("Numéro de commande invalide");
  await removeFile(`${prefix(slug)}${orderNumber}.json`);
}

export async function setOrderStatus(slug: string, orderNumber: string, status: OrderStatus) {
  if (!ORDER_NUMBER.test(orderNumber)) throw new Error("Numéro de commande invalide");
  const order = await getJSON<StoredOrder>(`${prefix(slug)}${orderNumber}.json`);
  if (!order) throw new Error("Commande introuvable");
  await saveOrder(slug, { ...order, status });
}
