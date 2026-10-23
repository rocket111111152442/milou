import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/admin/screens/OrderDetail";
import { get, getDoc } from "@/lib/db";
import { getStripe } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, delivery] = await Promise.all([get("orders", id), getDoc("delivery")]);
  if (!order) notFound();
  return <OrderDetail order={order} delivery={delivery} stripeEnabled={!!getStripe()} />;
}
