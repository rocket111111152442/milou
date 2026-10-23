import { Dashboard } from "@/components/admin/screens/Dashboard";
import { list, storageInfo } from "@/lib/db";
import { dashboardStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [orders, products, messages] = await Promise.all([list("orders"), list("products"), list("messages")]);
  const st = storageInfo();
  const label = st.kind === "redis" ? "Upstash Redis (persistant)" : st.kind === "file" ? "fichiers locaux .data/ (persistant)" : "mémoire (temporaire)";
  return <Dashboard s={dashboardStats(orders, products, messages)} storage={label} />;
}
