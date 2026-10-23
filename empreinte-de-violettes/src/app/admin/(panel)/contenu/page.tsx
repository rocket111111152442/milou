import { ContentEditor } from "@/components/admin/screens/DocEditors";
import { getDoc } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <ContentEditor initial={await getDoc("content")} />;
}
