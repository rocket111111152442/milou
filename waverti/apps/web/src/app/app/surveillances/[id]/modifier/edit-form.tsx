"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Checkbox, Field, Input, Label, Select, Switch } from "@waverti/ui";
import { formatInterval, type RuleConditionInput } from "@waverti/types";
import { normalizeRule, RuleBuilder, ruleProblem } from "@waverti/ui/app";
import { useApiAction } from "@/components/app/use-api";

interface Initial {
  name: string;
  condition: Record<string, unknown>;
  intervalMinutes: number;
  cssSelector: string;
  executionMode: "auto" | "local_only" | "cloud_only";
  notifyEmail: boolean;
  notifyDesktop: boolean;
  officialDomains: string[];
}

export function EditMonitorForm({ id, kind, initial, minInterval, cloudRelay, emailAlerts }: { id: string; kind: "page" | "web_topic"; initial: Initial; minInterval: number; cloudRelay: boolean; emailAlerts: boolean }) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const [name, setName] = useState(initial.name);
  const [interval, setInterval] = useState(Math.max(initial.intervalMinutes, minInterval));
  const [selector, setSelector] = useState(initial.cssSelector);
  const [exec, setExec] = useState(initial.executionMode);
  const [email, setEmail] = useState(initial.notifyEmail);
  const [desktop, setDesktop] = useState(initial.notifyDesktop);
  const [threshold, setThreshold] = useState(initial.condition.type === "price_below" ? String(initial.condition.threshold) : "");
  const [requireOfficial, setRequireOfficial] = useState(Boolean(initial.condition.requireOfficial));
  const [domains, setDomains] = useState(initial.officialDomains.join(", "));
  const isRule = initial.condition.type === "rule";
  const [rule, setRule] = useState(() => normalizeRule((isRule ? initial.condition : { type: "rule", conditions: [{ type: "page_changed" }] }) as RuleConditionInput));
  const [ruleError, setRuleError] = useState<string | null>(null);
  const options = [...new Set([minInterval, 120, 240, 360, 720, 1440, 2880, 10080].filter((m) => m >= minInterval))].sort((a, b) => a - b);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (isRule) {
      const problem = ruleProblem(rule);
      setRuleError(problem);
      if (problem) return;
    }
    const condition = isRule
      ? { type: "rule", ...rule }
      : initial.condition.type === "price_below"
        ? { ...initial.condition, threshold: Number(threshold.replace(",", ".")) }
        : initial.condition.type === "web_topic"
          ? { ...initial.condition, requireOfficial }
          : undefined;
    const body: Record<string, unknown> = {
      name,
      intervalMinutes: interval,
      notify: { email, desktop },
      ...(condition ? { condition } : {}),
      ...(kind === "page" ? { cssSelector: selector || null, ...(isRule ? {} : { executionMode: cloudRelay ? exec : "local_only" }) } : {}),
      ...(kind === "web_topic" ? { officialDomains: domains.split(/[,\s]+/).map((d) => d.trim().toLowerCase()).filter(Boolean).slice(0, 5) } : {}),
    };
    const r = await run(`/api/monitors/${id}`, body, { method: "PATCH", success: "Modifications enregistrées", refresh: false });
    if (r) router.push(`/app/surveillances/${id}`);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <Field id="e-name" label="Nom" required>
        {(p) => <Input {...p} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
      </Field>
      {isRule ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Conditions</p>
          <RuleBuilder value={rule} onChange={setRule} id="e-rb" />
          {ruleError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {ruleError}
            </p>
          ) : null}
        </div>
      ) : null}
      {initial.condition.type === "price_below" ? (
        <Field id="e-threshold" label="Seuil de prix (€)">
          {(p) => <Input {...p} inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="max-w-48" />}
        </Field>
      ) : null}
      {kind === "web_topic" ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="e-official">N'alerter que si une source officielle le confirme</Label>
            <Switch id="e-official" checked={requireOfficial} onCheckedChange={setRequireOfficial} />
          </div>
          <Field id="e-domains" label="Sites officiels">
            {(p) => <Input {...p} value={domains} onChange={(e) => setDomains(e.target.value)} />}
          </Field>
        </>
      ) : (
        <Field id="e-sel" label="Zone de la page (sélecteur CSS)">
          {(p) => <Input {...p} value={selector} maxLength={300} onChange={(e) => setSelector(e.target.value)} />}
        </Field>
      )}
      <Field id="e-interval" label="Fréquence">
        {(p) => (
          <Select {...p} value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
            {options.map((m) => (
              <option key={m} value={m}>
                {formatInterval(m).replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {kind === "page" && isRule ? <p className="text-sm text-muted-fg">Les règles personnalisées sont contrôlées par les serveurs Waverti.</p> : null}
      {kind === "page" && cloudRelay && !isRule ? (
        <Field id="e-exec" label="Exécution">
          {(p) => (
            <Select {...p} value={exec} onChange={(e) => setExec(e.target.value as Initial["executionMode"])}>
              <option value="auto">Ordinateur en priorité, serveurs en relais</option>
              <option value="local_only">Uniquement sur mon ordinateur</option>
              <option value="cloud_only">Uniquement sur les serveurs Waverti</option>
            </Select>
          )}
        </Field>
      ) : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Notifications</legend>
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={email && emailAlerts} disabled={!emailAlerts} onCheckedChange={(v) => setEmail(v === true)} /> Par e-mail
        </label>
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={desktop} onCheckedChange={(v) => setDesktop(v === true)} /> Sur le bureau
        </label>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
