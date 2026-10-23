import { OccasionsScreen } from "@/components/admin/screens/Collections";
import { list } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <OccasionsScreen items={await list("occasions")} />;
}
