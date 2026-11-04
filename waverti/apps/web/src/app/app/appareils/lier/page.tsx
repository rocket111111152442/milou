import type { Metadata } from "next";
import { normalizeUserCode } from "@waverti/auth";
import { PageHeader } from "@waverti/ui";
import { requireUser } from "@/lib/auth";
import { LinkDevice } from "./link-device";

export const metadata: Metadata = { title: "Relier un appareil" };

export default async function LinkDevicePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? normalizeUserCode(code) : null;
  await requireUser(initialCode ? `/app/appareils/lier?code=${encodeURIComponent(initialCode)}` : "/app/appareils/lier");
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader title="Relier un appareil à Waverti" description="Vérifiez que ce code est identique à celui affiché dans l’extension Chrome ou l’application Waverti." />
      <LinkDevice initialCode={initialCode ?? ""} />
    </div>
  );
}
