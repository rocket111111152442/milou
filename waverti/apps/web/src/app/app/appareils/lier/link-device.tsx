"use client";
import { useState } from "react";
import { Laptop } from "lucide-react";
import { Button, Callout, Card, CardContent, Field, Input } from "@waverti/ui";
import type { Platform } from "@waverti/types";
import { apiCall } from "@/components/app/use-api";

export function LinkDevice({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [state, setState] = useState<"idle" | "busy" | "approved" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<{ deviceName: string; platform: Platform } | null>(null);

  async function decide(approve: boolean) {
    setState("busy");
    setError(null);
    const r = await apiCall<{ device: { deviceName: string; platform: Platform } }>("/api/agent/link/approve", { body: { userCode: code, approve } });
    if (!r.ok) {
      setError(r.error.message ?? "Code invalide.");
      setState("idle");
      return;
    }
    setDevice(r.data.device);
    setState(approve ? "approved" : "denied");
  }

  if (state === "approved" && device) {
    return (
      <Callout tone="success" title="Liaison autorisée" role="status">
        {device.platform === "chrome"
          ? `Rouvrez « ${device.deviceName} » dans Chrome pour terminer la liaison. Vous pourrez ensuite autoriser les contrôles dans l’extension, puis choisir les fiches à surveiller.`
          : `Rouvrez « ${device.deviceName} » pour terminer la liaison et accepter les contrôles depuis cet ordinateur.`}
      </Callout>
    );
  }
  if (state === "denied") {
    return (
      <Callout tone="neutral" role="status">
        Liaison refusée. Aucun accès n'a été accordé.
      </Callout>
    );
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-surface">
          <Laptop className="size-5" aria-hidden="true" />
        </span>
        <Field id="code" label="Code de l’extension ou de l’application" hint="Format XXXX-XXXX. Validez uniquement un code que vous avez demandé.">
          {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={9} className="font-mono text-lg tracking-[0.2em]" autoComplete="off" />}
        </Field>
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
        <div className="flex gap-2">
          <Button onClick={() => decide(true)} loading={state === "busy"} disabled={code.replace(/[^A-Z0-9]/g, "").length !== 8}>
            Autoriser cet appareil
          </Button>
          <Button variant="ghost" onClick={() => decide(false)} disabled={state === "busy"}>
            Refuser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
