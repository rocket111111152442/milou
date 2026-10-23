import { DeliveryEditor } from "@/components/admin/screens/DocEditors";
import { getDoc } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <DeliveryEditor initial={await getDoc("delivery")} />;
}
