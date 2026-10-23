import { MessagesScreen } from "@/components/admin/screens/Collections";
import { list } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <MessagesScreen items={await list("messages")} />;
}
