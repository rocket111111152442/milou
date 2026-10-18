import { listOrders, storageEnabled, type StoredOrder } from "@/lib/orders-store";
import { ordersEnabled } from "@/lib/order-config";
import { getSettings } from "@/lib/settings-store";
import { SHOPS } from "@/lib/shops";
import { AdminDashboard } from "./AdminDashboard";

export const metadata = { title: "Commandes" };

export default async function AdminOrdersPage() {
  let orders: StoredOrder[] = [];
  let error: string | null = null;
  if (!storageEnabled()) error = "Le stockage des commandes n'est pas configuré (BLOB_READ_WRITE_TOKEN manquant).";
  else {
    try {
      orders = await listOrders();
    } catch (e) {
      error = `Impossible de lire les commandes : ${(e as Error).message}`;
    }
  }
  const settings = await getSettings();
  return <AdminDashboard orders={orders} error={error} liveShops={SHOPS.filter((s) => ordersEnabled(s.id, settings)).map((s) => s.id)} />;
}
