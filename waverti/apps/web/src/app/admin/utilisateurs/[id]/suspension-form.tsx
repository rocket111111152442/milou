"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Callout, Card, Field, Textarea } from "@waverti/ui";
import { apiCall } from "@/components/app/use-api";

export function SuspensionForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <Card className="p-5">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const r = await apiCall(`/api/admin/users/${userId}/suspension`, { body: { suspended: !suspended, reason } });
          setPending(false);
          if (!r.ok) return setError(r.error.issues?.[0]?.message ?? r.error.message ?? "Action impossible.");
          setReason("");
          router.refresh();
        }}
      >
        <Field id="reason" label={suspended ? "Motif de la réactivation" : "Motif de la suspension"} required hint="Enregistré dans le journal d'audit.">
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} maxLength={500} rows={2} />}
        </Field>
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
        <Button type="submit" variant={suspended ? "secondary" : "danger"} loading={pending} className="self-start">
          {suspended ? "Réactiver le compte" : "Suspendre le compte"}
        </Button>
      </form>
    </Card>
  );
}
