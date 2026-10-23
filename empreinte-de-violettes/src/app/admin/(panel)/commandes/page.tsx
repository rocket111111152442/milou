import { OrdersScreen } from "@/components/admin/screens/Orders";
import { list } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <OrdersScreen orders={await list("orders")} />;
}
