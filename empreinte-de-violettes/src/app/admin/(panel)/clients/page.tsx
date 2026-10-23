import { ClientsScreen } from "@/components/admin/screens/Clients";
import { list } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [orders, subs] = await Promise.all([list("orders"), list("subscribers")]);
  return <ClientsScreen orders={orders} subscribers={subs.map((s) => s.email.toLowerCase())} />;
}
