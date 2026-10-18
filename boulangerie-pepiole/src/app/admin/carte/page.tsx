import { getSettingsFresh } from "@/lib/settings-store";
import { PriceEditor } from "./PriceEditor";

export const metadata = { title: "Carte & prix" };

export default async function AdminCartePage() {
  const settings = await getSettingsFresh();
  return <PriceEditor initialPrices={settings.prices} initialUnavailable={settings.unavailable} updatedAt={settings.updatedAt ?? null} />;
}
