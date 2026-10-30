"use client";
import { useState } from "react";
import { Button, Dialog, DialogClose, DialogContent, DialogTrigger, Input, Label } from "@waverti/ui";
import { useApiAction } from "@/components/app/use-api";

export function PlanActions({ mode, planId, planName }: { mode: "change" | "resume"; planId?: string; planName?: string }) {
  const { run, pending } = useApiAction();
  if (mode === "resume") {
    return (
      <Button variant="secondary" loading={pending} onClick={() => run("/api/billing/resume", {}, { success: "Résiliation annulée" })}>
        Annuler la résiliation
      </Button>
    );
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          Passer à {planName}
        </Button>
      </DialogTrigger>
      <DialogContent title={`Passer à ${planName} ?`} description="Le changement est immédiat et proratisé : la différence de prix est ajustée sur votre prochaine facture.">
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Annuler</Button>
          </DialogClose>
          <Button loading={pending} onClick={() => run("/api/billing/change-plan", { planId }, { success: "Changement demandé à Stripe" })}>
            Confirmer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PortalButton() {
  const { run, pending } = useApiAction();
  return (
    <Button
      loading={pending}
      onClick={async () => {
        const r = await run<{ url: string }>("/api/billing/portal", {}, { refresh: false });
        if (r?.url) window.location.assign(r.url);
      }}
    >
      Factures et moyen de paiement
    </Button>
  );
}

export function ExtraSitesControl({ current }: { current: number }) {
  const [qty, setQty] = useState(current);
  const { run, pending } = useApiAction();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="extra-sites">Sites supplémentaires</Label>
        <Input id="extra-sites" type="number" min={0} max={20} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-28" />
      </div>
      <Button variant="secondary" loading={pending} disabled={qty === current} onClick={() => run("/api/billing/extra-sites", { quantity: qty }, { success: "Mise à jour demandée" })}>
        Mettre à jour
      </Button>
    </div>
  );
}
