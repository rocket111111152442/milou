import { notFound } from "next/navigation";
import { getSettingsFresh } from "@/lib/settings-store";
import { getTenantFresh } from "@/lib/tenant-store";
import { countDevices, pushConfigured } from "@/lib/push";
import { ShopSettings } from "./ShopSettings";
import { Notifications } from "./Notifications";
import { ResetAll } from "./ResetAll";

export const metadata = { title: "Réglages" };

export default async function AdminReglagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantFresh(slug);
  if (!tenant) notFound();
  const settings = await getSettingsFresh(slug, tenant.products);
  const devices = await countDevices(slug).catch(() => 0);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-8">
      <h1 className="font-display text-3xl tracking-tight">Réglages</h1>
      <Notifications configured={pushConfigured()} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} devices={devices} />
      <ShopSettings key={settings.updatedAt ?? "init"} initialLive={settings.live} initialClosed={settings.closedDates} />
      <ResetAll />
    </div>
  );
}
