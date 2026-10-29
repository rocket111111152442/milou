"use client";
import { useRouter } from "next/navigation";
import { Button } from "@watchly/ui";
import { useApiAction } from "@/components/app/use-api";

export function CancelButton() {
  const { run, pending } = useApiAction();
  const router = useRouter();
  return (
    <Button
      variant="danger"
      size="lg"
      loading={pending}
      onClick={async () => {
        const r = await run("/api/billing/cancel", {}, { success: "Résiliation enregistrée", refresh: false });
        if (r) router.push("/app/abonnement");
      }}
    >
      Confirmer la résiliation
    </Button>
  );
}
