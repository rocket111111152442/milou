import { notFound } from "next/navigation";
import { listOrders, storageEnabled, type StoredOrder } from "@/lib/orders-store";
import { ordersEnabled } from "@/lib/order-config";
import { getSettings } from "@/lib/settings-store";
import { getTenantFresh } from "@/lib/tenant-store";
import { AdminDashboard } from "./AdminDashboard";

export const metadata = { title: "Commandes" };

export default async function AdminOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantFresh(slug);
  if (!tenant) notFound();
  let orders: StoredOrder[] = [];
  let error: string | null = null;
  if (!storageEnabled()) error = "Le stockage des commandes n'est pas configuré (BLOB_READ_WRITE_TOKEN manquant).";
  else {
    try {
      orders = await listOrders(slug);
    } catch (e) {
      error = `Impossible de lire les commandes : ${(e as Error).message}`;
    }
  }
  const settings = await getSettings(slug, tenant.products);
  return <AdminDashboard orders={orders} error={error} liveShops={tenant.shops.filter((s) => ordersEnabled(tenant, s, settings)).map((s) => s.id)} />;
}
