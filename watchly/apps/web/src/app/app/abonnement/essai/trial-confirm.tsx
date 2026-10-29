"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { Button, Checkbox, Label } from "@watchly/ui";
import { useApiAction } from "@/components/app/use-api";

export function TrialConfirm({ planId, trial }: { planId: string; trial: boolean }) {
  const [ack, setAck] = useState(false);
  const { run, pending } = useApiAction();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Checkbox id="ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
        <Label htmlFor="ack" className="font-normal leading-relaxed text-ink-soft">
          {trial
            ? "J'ai compris que le prélèvement mensuel commencera à la fin de l'essai si je ne résilie pas avant."
            : "J'ai compris que le premier paiement a lieu dès la validation, puis chaque mois."}
        </Label>
      </div>
      <Button
        size="lg"
        disabled={!ack}
        loading={pending}
        onClick={async () => {
          const r = await run<{ url: string }>("/api/billing/checkout", { planId, acknowledged: true }, { refresh: false });
          if (r?.url) window.location.assign(r.url);
        }}
      >
        <Lock aria-hidden="true" /> Continuer vers le paiement sécurisé
      </Button>
    </div>
  );
}
