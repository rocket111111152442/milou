import { SettingsEditor } from "@/components/admin/screens/Settings";
import { usingDefaultPassword } from "@/lib/auth";
import { getDoc, storageInfo } from "@/lib/db";
import { siteUrl } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function Page() {
  const st = storageInfo();
  const key = process.env.STRIPE_SECRET_KEY;
  return (
    <SettingsEditor
      initial={await getDoc("settings")}
      integrations={{
        storage: st.kind === "redis" ? "Upstash Redis" : st.kind === "file" ? "fichiers locaux" : "mémoire temporaire",
        persistent: st.persistent,
        stripe: !!key,
        stripeMode: key ? (key.startsWith("sk_live") || key.startsWith("rk_live") ? "live" : "test") : null,
        webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
        resend: !!process.env.RESEND_API_KEY,
        blob: !!process.env.BLOB_READ_WRITE_TOKEN,
        siteUrl: siteUrl(),
        defaultPassword: usingDefaultPassword(),
      }}
    />
  );
}
