import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Callout, Card, Checkbox, Label, Logo } from "@watchly/ui";
import { api } from "../lib/api";

export interface Me {
  user: { email: string; displayName: string | null };
  device: { id: string; name: string; platform: string; monitoringEnabled: boolean; consentLocalAt: string | null } | undefined;
  plan: { id: string; name: string; cloudRelay: boolean; maxMonitors: number; pageIntervalMinutes: number; isTrial: boolean };
  consent: { version: string; text: string; accepted: boolean };
}

/**
 * Accord explicite et obligatoire avant tout contrôle exécuté sur cet ordinateur.
 * Le texte et sa version viennent du serveur, qui horodate l'acceptation.
 * Refuser laisse l'application utilisable, mais aucun contrôle n'est fait localement.
 */
export function ConsentScreen({ me, onDone }: { me: Me; onDone: (accepted: boolean) => void }) {
  const [checked, setChecked] = React.useState(false);
  const [pending, setPending] = React.useState<"accept" | "refuse" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const decide = async (accepted: boolean) => {
    setPending(accepted ? "accept" : "refuse");
    setError(null);
    try {
      await api("POST", "/api/agent/consent", { accepted, consentVersion: me.consent.version });
      onDone(accepted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <main className="grid min-h-full place-items-center bg-surface px-4 py-10">
      <Card className="w-full max-w-xl p-8">
        <Logo className="h-7" />
        <div className="mt-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-info-soft text-blue">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">Fonctionnement sur cet ordinateur</h1>
        </div>
        <p className="mt-3 text-sm text-muted-fg">
          Compte : <span className="font-medium text-ink">{me.user.email}</span> · Formule {me.plan.name}
        </p>
        <div className="mt-6 whitespace-pre-line rounded-xl border border-line bg-white p-5 text-sm leading-relaxed">{me.consent.text}</div>
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-muted-fg">
          <li>Seules VOS surveillances sont contrôlées ici, jamais celles d'un autre utilisateur.</li>
          <li>L'icône Watchly reste visible tant que l'application fonctionne ; vous pouvez la mettre en pause ou la quitter à tout moment.</li>
          <li>Vous pouvez retirer votre accord dans les paramètres.</li>
        </ul>
        <div className="mt-6 flex items-start gap-3">
          <Checkbox id="consent" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          <Label htmlFor="consent" className="text-sm font-normal leading-snug">
            J'ai lu ce texte et j'accepte que Watchly effectue mes contrôles de pages depuis cet ordinateur.
          </Label>
        </div>
        {error ? (
          <Callout tone="danger" role="alert" className="mt-5">
            {error}
          </Callout>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => void decide(false)} loading={pending === "refuse"} disabled={pending !== null}>
            Refuser
          </Button>
          <Button onClick={() => void decide(true)} loading={pending === "accept"} disabled={!checked || pending !== null}>
            Accepter et activer
          </Button>
        </div>
        {!me.plan.cloudRelay ? (
          <p className="mt-5 text-xs text-muted-fg">
            Avec la formule {me.plan.name}, vos pages ne sont contrôlées que par cet ordinateur : si vous refusez, elles ne seront pas vérifiées.
          </p>
        ) : null}
      </Card>
    </main>
  );
}
