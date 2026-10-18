import { getSettingsFresh } from "@/lib/settings-store";
import { countDevices, pushConfigured } from "@/lib/push";
import { ShopSettings } from "./ShopSettings";
import { Notifications } from "./Notifications";

export const metadata = { title: "Réglages" };

export default async function AdminReglagesPage() {
  const settings = await getSettingsFresh();
  const devices = await countDevices().catch(() => 0);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-8">
      <h1 className="font-display text-3xl tracking-tight">Réglages</h1>
      <Notifications configured={pushConfigured()} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} devices={devices} />
      <ShopSettings initialLive={settings.live} initialClosed={settings.closedDates} envLive={process.env.ORDERS_LIVE === "1"} />
    </div>
  );
}
