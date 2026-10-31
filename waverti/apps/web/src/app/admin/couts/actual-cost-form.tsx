"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Callout, Field, Input } from "@waverti/ui";
import { apiCall } from "@/components/app/use-api";

const PROVIDERS = [
  ["brave_search", "Brave Search"],
  ["resend", "Resend"],
  ["smtp", "SMTP"],
  ["vercel", "Vercel"],
  ["server", "Serveur (worker, base)"],
  ["other", "Autre"],
] as const;

/** Saisie du montant réellement facturé par un fournisseur (rapproché des estimations). */
export function ActualCostForm({ month }: { month: string }) {
  const router = useRouter();
  const [provider, setProvider] = useState<string>("brave_search");
  const [m, setM] = useState(month);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const r = await apiCall("/api/admin/provider-costs", {
          body: { provider, month: m, amountEur: Number(amount.replace(",", ".")), note: note || undefined },
        });
        setPending(false);
        if (!r.ok) return setError(r.error.issues?.[0]?.message ?? r.error.message ?? "Enregistrement impossible.");
        setAmount("");
        setNote("");
        router.refresh();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="cost-provider" label="Fournisseur">
          {(p) => (
            <select {...p} className="h-10 rounded-lg border border-line bg-white px-3 text-sm" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="cost-month" label="Mois (AAAA-MM)">
          {(p) => <Input {...p} value={m} onChange={(e) => setM(e.target.value)} pattern="\d{4}-\d{2}" required />}
        </Field>
        <Field id="cost-amount" label="Montant facturé (€ HT)">
          {(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />}
        </Field>
      </div>
      <Field id="cost-note" label="Note (facultatif)" hint="Ex. numéro de facture.">
        {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
      </Field>
      {error ? (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      ) : null}
      <Button type="submit" loading={pending} className="self-start">
        Enregistrer le coût réel
      </Button>
    </form>
  );
}
