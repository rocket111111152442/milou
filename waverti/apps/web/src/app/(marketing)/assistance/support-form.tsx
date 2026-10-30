"use client";
import { useState } from "react";
import { Button, Callout, Field, Input, Select, Textarea } from "@waverti/ui";

export function SupportForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    }).catch(() => null);
    if (res?.ok) {
      setState("sent");
      return;
    }
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "Envoi impossible pour le moment. Réessayez plus tard.");
    setState("error");
  }

  if (state === "sent") {
    return (
      <Callout tone="success" title="Demande envoyée" role="status">
        Merci, votre demande a bien été enregistrée. Nous vous répondrons par e-mail.
      </Callout>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6 sm:p-8" noValidate={false}>
      <Field id="support-email" label="Adresse e-mail" required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required maxLength={254} />}
      </Field>
      <Field id="support-category" label="Catégorie">
        {(p) => (
          <Select {...p} name="category" defaultValue="other">
            <option value="account">Compte et connexion</option>
            <option value="billing">Abonnement et paiement</option>
            <option value="monitoring">Surveillances</option>
            <option value="desktop">Application desktop</option>
            <option value="business">Waverti Business</option>
            <option value="privacy">Confidentialité et données</option>
            <option value="abuse">Signaler un abus</option>
            <option value="other">Autre</option>
          </Select>
        )}
      </Field>
      <Field id="support-subject" label="Sujet" required>
        {(p) => <Input {...p} name="subject" required minLength={3} maxLength={200} />}
      </Field>
      <Field id="support-message" label="Message" required hint="N'indiquez jamais de mot de passe ni de numéro de carte.">
        {(p) => <Textarea {...p} name="message" required minLength={10} maxLength={5000} rows={6} />}
      </Field>
      {/* Champ piège anti-robots : invisible pour les humains */}
      <div aria-hidden="true" className="hidden">
        <label>
          Site web <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error ? (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      ) : null}
      <Button type="submit" loading={state === "sending"} size="lg">
        Envoyer ma demande
      </Button>
    </form>
  );
}
