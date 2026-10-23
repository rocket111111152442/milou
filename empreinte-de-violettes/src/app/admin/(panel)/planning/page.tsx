import { PlanningScreen } from "@/components/admin/screens/Planning";
import { getDoc, list } from "@/lib/db";
import { parisNow } from "@/lib/delivery";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [orders, delivery, settings] = await Promise.all([list("orders"), getDoc("delivery"), getDoc("settings")]);
  return <PlanningScreen orders={orders} delivery={delivery} today={parisNow().date} shopAddress={`${settings.address}, ${settings.postcode} ${settings.city}`} />;
}
