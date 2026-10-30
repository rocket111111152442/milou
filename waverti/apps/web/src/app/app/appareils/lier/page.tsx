import type { Metadata } from "next";
import { PageHeader } from "@waverti/ui";
import { requireUser } from "@/lib/auth";
import { LinkDevice } from "./link-device";

export const metadata: Metadata = { title: "Relier l'application" };

export default async function LinkDevicePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requireUser("/app/appareils/lier");
  const { code } = await searchParams;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader title="Relier l'application Waverti" description="Vérifiez que le code ci-dessous est identique à celui affiché par l'application sur votre ordinateur." />
      <LinkDevice initialCode={code ?? ""} />
    </div>
  );
}
