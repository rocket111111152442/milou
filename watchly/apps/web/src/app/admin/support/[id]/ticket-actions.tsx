"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Callout, Card, Field, Textarea } from "@watchly/ui";
import { apiCall } from "@/components/app/use-api";

export function TicketActions({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const send = async (body: Record<string, unknown>, key: string) => {
    setPending(key);
    setError(null);
    const r = await apiCall(`/api/admin/tickets/${ticketId}`, { body });
    setPending(null);
    if (!r.ok) return setError(r.error.message ?? "Action impossible.");
    if (key === "reply") setReply("");
    router.refresh();
  };
  return (
    <Card className="flex flex-col gap-3 p-5">
      <Field id="reply" label="Réponse (envoyée par e-mail au demandeur)" hint="Ne demandez jamais de mot de passe ni de numéro de carte.">
        {(p) => <Textarea {...p} rows={6} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} />}
      </Field>
      {error ? (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button loading={pending === "reply"} disabled={reply.trim().length < 2 || pending !== null} onClick={() => void send({ reply }, "reply")}>
          Envoyer la réponse
        </Button>
        {status !== "closed" ? (
          <Button variant="secondary" loading={pending === "close"} disabled={pending !== null} onClick={() => void send({ status: "closed" }, "close")}>
            Clore la demande
          </Button>
        ) : (
          <Button variant="secondary" loading={pending === "open"} disabled={pending !== null} onClick={() => void send({ status: "open" }, "open")}>
            Rouvrir
          </Button>
        )}
      </div>
    </Card>
  );
}
