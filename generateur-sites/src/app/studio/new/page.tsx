import { emptyInput } from "@/lib/tenant-input";
import { SiteForm } from "../SiteForm";

export const metadata = { title: "Nouveau site" };

export default function NewSitePage() {
  return <SiteForm initial={emptyInput()} />;
}
