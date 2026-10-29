"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Callout, Card, Field, Input } from "@watchly/ui";
import { apiCall } from "@/components/app/use-api";

export function NewSiteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <Card className="p-6">
      <form
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const r = await apiCall<{ id: string }>("/api/business/sites", { body: { name, domain } });
          setPending(false);
          if (!r.ok) return setError(r.error.message ?? "Création impossible.");
          router.push(`/app/business/sites/${r.data.id}`);
        }}
      >
        <Field id="site-name" label="Nom du site" required>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required placeholder="Ma boutique" />}
        </Field>
        <Field id="site-domain" label="Domaine" required hint="Par exemple : maboutique.fr (sans https:// ni chemin). Les sous-domaines pourront être contrôlés.">
          {(p) => <Input {...p} value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={253} required placeholder="maboutique.fr" />}
        </Field>
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
        <Button type="submit" loading={pending} className="self-start">
          Continuer vers la vérification
        </Button>
      </form>
    </Card>
  );
}
