import "server-only";
import { dbEnabled, query } from "./db";
import type { ShopId } from "./shops";

// Commandes enregistrées dans Postgres (table petrin_orders : une ligne par commande, le détail en JSON).

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

export function storageEnabled() {
  return dbEnabled();
}

export async function saveOrder(order: StoredOrder) {
  await query(
    `insert into petrin_orders (order_number, created_at, status, data) values ($1, $2, $3, $4)
     on conflict (order_number) do update set status = excluded.status, data = excluded.data`,
    [order.orderNumber, order.createdAt, order.status, JSON.stringify(order)],
  );
}

/** Les commandes les plus récentes (300 max), de la plus récente à la plus ancienne. */
export async function listOrders(limit = 300): Promise<StoredOrder[]> {
  const { rows } = await query<{ data: StoredOrder }>("select data from petrin_orders order by created_at desc limit $1", [limit]);
  return rows.map((r) => r.data);
}

const ORDER_NUMBER = /^PP-\d{6}-[A-Z0-9]{4}$/;

/** Supprime définitivement une commande. */
export async function deleteOrder(orderNumber: string) {
  if (!ORDER_NUMBER.test(orderNumber)) throw new Error("Numéro de commande invalide");
  await query("delete from petrin_orders where order_number = $1", [orderNumber]);
}

export async function setOrderStatus(orderNumber: string, status: OrderStatus) {
  if (!ORDER_NUMBER.test(orderNumber)) throw new Error("Numéro de commande invalide");
  const { rowCount } = await query(
    "update petrin_orders set status = $2, data = jsonb_set(data, '{status}', to_jsonb($2::text)) where order_number = $1",
    [orderNumber, status],
  );
  if (!rowCount) throw new Error("Commande introuvable");
}

/** Supprime toutes les commandes ; renvoie leur nombre. */
export async function wipeOrders() {
  const { rowCount } = await query("delete from petrin_orders");
  return rowCount ?? 0;
}
