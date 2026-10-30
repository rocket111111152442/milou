"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Field,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@waverti/ui";
import { SiteStateIndicator } from "@waverti/ui/app";
import { formatDateTime, formatRelative, type ScenarioStep } from "@waverti/types";
import { apiCall, useApiAction } from "@/components/app/use-api";

function CopyValue({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
      <code className="flex-1 break-all font-mono text-sm">{value}</code>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Copier ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => undefined);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
    </div>
  );
}

export function VerificationPanel({
  siteId,
  domain,
  instructions,
  attempts,
}: {
  siteId: string;
  domain: string;
  instructions: { dns: { host: string; type: string; value: string }; file: { url: string; content: string } };
  attempts: Array<{ at: string; method: string; success: boolean; detail: string | null }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"dns" | "file" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const verify = async (method: "dns" | "file") => {
    setPending(method);
    setResult(null);
    const r = await apiCall<{ verified: boolean; detail: string }>(`/api/business/sites/${siteId}/verify`, { body: { method } });
    setPending(null);
    if (!r.ok) return setResult({ ok: false, detail: r.error.message ?? "Vérification impossible." });
    setResult({ ok: r.data.verified, detail: r.data.detail });
    if (r.data.verified) router.refresh();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prouvez que vous êtes propriétaire de {domain}</CardTitle>
        <p className="text-sm text-muted-fg">
          Waverti ne surveille que les sites dont la propriété est prouvée. Choisissez l'une des deux méthodes, puis lancez la vérification.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Tabs defaultValue="dns">
          <TabsList>
            <TabsTrigger value="dns">Enregistrement DNS</TabsTrigger>
            <TabsTrigger value="file">Fichier sur le site</TabsTrigger>
          </TabsList>
          <TabsContent value="dns" className="flex flex-col gap-3 pt-4">
            <p className="text-sm">Chez votre hébergeur de domaine, ajoutez un enregistrement de type TXT :</p>
            <p className="text-sm text-muted-fg">Nom (hôte)</p>
            <CopyValue value={instructions.dns.host} label="le nom de l'enregistrement" />
            <p className="text-sm text-muted-fg">Valeur</p>
            <CopyValue value={instructions.dns.value} label="la valeur de l'enregistrement" />
            <p className="text-xs text-muted-fg">La propagation DNS peut prendre de quelques minutes à quelques heures.</p>
            <Button className="self-start" loading={pending === "dns"} disabled={pending !== null} onClick={() => void verify("dns")}>
              Vérifier l'enregistrement DNS
            </Button>
          </TabsContent>
          <TabsContent value="file" className="flex flex-col gap-3 pt-4">
            <p className="text-sm">Publiez un fichier texte à cette adresse :</p>
            <CopyValue value={instructions.file.url} label="l'adresse du fichier" />
            <p className="text-sm text-muted-fg">avec ce contenu exact :</p>
            <CopyValue value={instructions.file.content} label="le contenu du fichier" />
            <Button className="self-start" loading={pending === "file"} disabled={pending !== null} onClick={() => void verify("file")}>
              Vérifier le fichier
            </Button>
          </TabsContent>
        </Tabs>
        {result ? (
          <Callout tone={result.ok ? "success" : "warning"} role="status" title={result.ok ? "Site vérifié" : "Vérification non concluante"}>
            {result.detail}
          </Callout>
        ) : null}
        {attempts.length ? (
          <div className="text-sm">
            <p className="font-medium">Dernières tentatives</p>
            <ul className="mt-2 flex flex-col gap-1 text-muted-fg">
              {attempts.map((a) => (
                <li key={a.at}>
                  {formatDateTime(a.at)} · {a.method === "dns" ? "DNS" : "Fichier"} · {a.success ? "réussie" : "échec"}
                  {a.detail ? ` — ${a.detail}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SiteActions({ siteId, name }: { siteId: string; name: string }) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Trash2 aria-hidden="true" /> Supprimer le site
        </Button>
      </DialogTrigger>
      <DialogContent title={`Supprimer « ${name} » ?`} description="Les points de contrôle, scénarios, incidents et statistiques de ce site seront supprimés définitivement.">
        <div className="mt-6 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Annuler</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={pending}
            onClick={async () => {
              const ok = await run(`/api/business/sites/${siteId}`, undefined, { method: "DELETE", success: "Site supprimé", refresh: false });
              if (ok) router.push("/app/business");
            }}
          >
            Supprimer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EndpointRow {
  id: string;
  name: string;
  url: string;
  method: string;
  enabled: boolean;
  state: "unknown" | "up" | "down" | "degraded";
  lastCheckedAt: string | null;
  lastResponseMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  expectedKeyword: string | null;
}

export function EndpointsPanel({ siteId, domain, limit, intervalSeconds, endpoints }: { siteId: string; domain: string; limit: number; intervalSeconds: number; endpoints: EndpointRow[] }) {
  const router = useRouter();
  const { push } = useToast();
  const { run } = useApiAction();
  const [name, setName] = useState("");
  const [url, setUrl] = useState(`https://${domain}/`);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const full = endpoints.length >= limit;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Points de contrôle ({endpoints.length}/{limit})</CardTitle>
        <p className="text-sm text-muted-fg">
          Vérifiés toutes les {intervalSeconds >= 60 ? `${Math.round(intervalSeconds / 60)} minute(s)` : `${intervalSeconds} s`} par les serveurs Waverti. Une panne est
          confirmée par un second contrôle avant toute alerte.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {endpoints.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {endpoints.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {e.name} {e.enabled ? <SiteStateIndicator state={e.state} /> : <Badge>Désactivé</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted-fg">
                    {e.method} {e.url}
                    {e.expectedKeyword ? ` · texte attendu « ${e.expectedKeyword} »` : ""}
                  </p>
                  <p className="text-xs text-muted-fg">
                    {e.lastCheckedAt
                      ? `Dernier contrôle ${formatRelative(e.lastCheckedAt)} · ${e.lastStatusCode ?? "—"} · ${e.lastResponseMs ?? "—"} ms${e.lastError ? ` · ${e.lastError}` : ""}`
                      : "En attente du premier contrôle"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(`/api/business/endpoints/${e.id}`, { enabled: !e.enabled }, { method: "PATCH", success: e.enabled ? "Point de contrôle désactivé" : "Point de contrôle activé" })}
                  >
                    {e.enabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {e.enabled ? "Désactiver" : "Activer"}
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${e.name}`} onClick={() => run(`/api/business/endpoints/${e.id}`, undefined, { method: "DELETE", success: "Point de contrôle supprimé" })}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {full ? (
          <p className="text-sm text-muted-fg">Nombre maximal de points de contrôle atteint pour ce site.</p>
        ) : (
          <form
            className="grid gap-4 rounded-xl border border-dashed border-line-strong p-4 md:grid-cols-[1fr_2fr_1fr_auto] md:items-end"
            onSubmit={async (ev) => {
              ev.preventDefault();
              setPending(true);
              setError(null);
              const r = await apiCall(`/api/business/sites/${siteId}/endpoints`, { body: { name, url, expectedKeyword: keyword || undefined } });
              setPending(false);
              if (!r.ok) return setError(r.error.message ?? "Ajout impossible.");
              push({ tone: "success", title: "Point de contrôle ajouté", description: "Premier contrôle dans moins d'une minute." });
              setName("");
              setKeyword("");
              router.refresh();
            }}
          >
            <Field id="ep-name" label="Nom" required>
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Page d'accueil" />}
            </Field>
            <Field id="ep-url" label="Adresse" required>
              {(p) => <Input {...p} type="url" value={url} onChange={(e) => setUrl(e.target.value)} required maxLength={2048} />}
            </Field>
            <Field id="ep-keyword" label="Texte attendu (facultatif)">
              {(p) => <Input {...p} value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={200} />}
            </Field>
            <Button type="submit" loading={pending}>
              <Plus aria-hidden="true" /> Ajouter
            </Button>
            {error ? (
              <Callout tone="danger" role="alert" className="md:col-span-4">
                {error}
              </Callout>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

interface ScenarioRow {
  id: string;
  name: string;
  startUrl: string;
  steps: number;
  enabled: boolean;
  lastStatus: "passed" | "failed" | "error" | null;
  lastRunAt: string | null;
  lastError: string | null;
  nextRunAt: string;
}

const ACTIONS: Array<{ value: ScenarioStep["action"]; label: string }> = [
  { value: "expect_text", label: "Vérifier qu'un texte est affiché" },
  { value: "click", label: "Cliquer sur un élément" },
  { value: "fill", label: "Remplir un champ" },
  { value: "press", label: "Appuyer sur une touche" },
  { value: "expect_visible", label: "Vérifier qu'un élément est visible" },
  { value: "expect_url", label: "Vérifier l'adresse de la page" },
  { value: "goto", label: "Aller à une adresse" },
  { value: "wait", label: "Attendre" },
];

type DraftStep = { action: ScenarioStep["action"]; a: string; b: string };

function toStep(d: DraftStep): ScenarioStep {
  switch (d.action) {
    case "goto":
      return { action: "goto", url: d.a };
    case "click":
      return { action: "click", selector: d.a };
    case "fill":
      return { action: "fill", selector: d.a, value: d.b };
    case "press":
      return { action: "press", selector: d.a, key: (["Enter", "Tab", "Escape"].includes(d.b) ? d.b : "Enter") as "Enter" };
    case "expect_text":
      return { action: "expect_text", text: d.a };
    case "expect_visible":
      return { action: "expect_visible", selector: d.a };
    case "expect_url":
      return { action: "expect_url", contains: d.a };
    case "wait":
      return { action: "wait", ms: Math.min(10_000, Math.max(100, Number(d.a) || 1000)) };
  }
}

const FIELD_A: Record<ScenarioStep["action"], string> = {
  goto: "Adresse (sur votre domaine)",
  click: "Sélecteur CSS ou text=…",
  fill: "Sélecteur du champ",
  press: "Sélecteur du champ",
  expect_text: "Texte attendu",
  expect_visible: "Sélecteur CSS",
  expect_url: "L'adresse contient",
  wait: "Durée (ms)",
};

export function ScenariosPanel({ siteId, domain, limit, scenarios }: { siteId: string; domain: string; limit: number; scenarios: ScenarioRow[] }) {
  const router = useRouter();
  const { push } = useToast();
  const { run } = useApiAction();
  const [name, setName] = useState("");
  const [startUrl, setStartUrl] = useState(`https://${domain}/`);
  const [steps, setSteps] = useState<DraftStep[]>([{ action: "expect_text", a: "", b: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const full = scenarios.length >= limit;
  const STATUS = { passed: { t: "Réussi", tone: "success" }, failed: { t: "Échec", tone: "danger" }, error: { t: "Erreur", tone: "warning" } } as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scénario de parcours ({scenarios.length}/{limit})</CardTitle>
        <p className="text-sm text-muted-fg">
          Exécuté dans un vrai navigateur par les serveurs Waverti, uniquement sur {domain}. Par sécurité, les actions d'achat, de paiement ou de suppression et la
          saisie de données bancaires ou de mots de passe sont bloquées.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {scenarios.map((s) => (
          <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {s.name}
                {s.lastStatus ? <Badge tone={STATUS[s.lastStatus].tone}>{STATUS[s.lastStatus].t}</Badge> : <Badge>Jamais exécuté</Badge>}
                {!s.enabled ? <Badge>Désactivé</Badge> : null}
              </p>
              <p className="truncate text-sm text-muted-fg">
                {s.steps} étape(s) · départ {s.startUrl}
              </p>
              <p className="text-xs text-muted-fg">
                {s.lastRunAt ? `Dernière exécution ${formatRelative(s.lastRunAt)}` : "Première exécution prévue sous peu"}
                {s.enabled ? ` · prochaine ${formatRelative(s.nextRunAt)}` : ""}
                {s.lastError ? ` · ${s.lastError}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="sm" disabled={!s.enabled} onClick={() => run(`/api/business/scenarios/${s.id}/run`, {}, { success: "Exécution demandée" })}>
                <RefreshCw aria-hidden="true" /> Exécuter
              </Button>
              <Button variant="ghost" size="sm" onClick={() => run(`/api/business/scenarios/${s.id}`, { enabled: !s.enabled }, { method: "PATCH", success: s.enabled ? "Scénario désactivé" : "Scénario activé" })}>
                {s.enabled ? "Désactiver" : "Activer"}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${s.name}`} onClick={() => run(`/api/business/scenarios/${s.id}`, undefined, { method: "DELETE", success: "Scénario supprimé" })}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
        {full ? null : (
          <form
            className="flex flex-col gap-4 rounded-xl border border-dashed border-line-strong p-4"
            onSubmit={async (ev) => {
              ev.preventDefault();
              setPending(true);
              setError(null);
              const r = await apiCall(`/api/business/sites/${siteId}/scenarios`, { body: { name, startUrl, steps: steps.map(toStep) } });
              setPending(false);
              if (!r.ok) return setError(r.error.message ?? "Création impossible.");
              push({ tone: "success", title: "Scénario créé", description: "Première exécution dans les prochaines minutes." });
              setName("");
              setSteps([{ action: "expect_text", a: "", b: "" }]);
              router.refresh();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="sc-name" label="Nom du scénario" required>
                {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Recherche d'un produit" />}
              </Field>
              <Field id="sc-start" label="Page de départ" required>
                {(p) => <Input {...p} type="url" value={startUrl} onChange={(e) => setStartUrl(e.target.value)} required />}
              </Field>
            </div>
            <ol className="flex flex-col gap-3">
              {steps.map((s, i) => (
                <li key={i} className="grid gap-2 md:grid-cols-[auto_1.2fr_1.5fr_1fr_auto] md:items-end">
                  <span className="pb-2 text-sm font-semibold text-muted-fg">{i + 1}.</span>
                  <Field id={`st-a-${i}`} label="Action">
                    {(p) => (
                      <Select {...p} value={s.action} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, action: e.target.value as DraftStep["action"] } : x)))}>
                        {ACTIONS.map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field id={`st-b-${i}`} label={FIELD_A[s.action]}>
                    {(p) => <Input {...p} value={s.a} required onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />}
                  </Field>
                  {s.action === "fill" || s.action === "press" ? (
                    <Field id={`st-c-${i}`} label={s.action === "fill" ? "Valeur" : "Touche (Enter, Tab, Escape)"}>
                      {(p) => <Input {...p} value={s.b} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))} />}
                    </Field>
                  ) : (
                    <span />
                  )}
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Retirer l'étape ${i + 1}`} disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={steps.length >= 20} onClick={() => setSteps([...steps, { action: "click", a: "", b: "" }])}>
                <Plus aria-hidden="true" /> Ajouter une étape
              </Button>
              <Button type="submit" size="sm" loading={pending}>
                Créer le scénario
              </Button>
            </div>
            {error ? (
              <Callout tone="danger" role="alert">
                {error}
              </Callout>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
