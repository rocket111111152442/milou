import { getSettingsFresh } from "@/lib/settings-store";
import { CatalogEditor } from "./CatalogEditor";

export const metadata = { title: "Carte & prix" };

export default async function AdminCartePage() {
  const s = await getSettingsFresh();
  return (
    <CatalogEditor
      initial={{ prices: s.prices, unavailable: s.unavailable, hidden: s.hidden, custom: s.custom }}
      updatedAt={s.updatedAt ?? null}
    />
  );
}
