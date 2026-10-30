"use client";
/**
 * Formulaire de surveillance partagé (web + application desktop).
 * Toute la validation est refaite côté serveur : ce composant guide l'utilisateur mais
 * n'est jamais une barrière de sécurité.
 */
import * as React from "react";
import { Globe, Search, ScanSearch, Sparkles, Lock } from "lucide-react";
import { formatInterval, formatPrice, type CreateMonitorInput, type PageCondition, type WebTopicCondition } from "@waverti/types";
import { cn } from "../lib/cn";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Callout } from "../components/feedback";
import { Checkbox, Switch } from "../components/controls";
import { Field, Input, Label, Select, Textarea } from "../components/form";

export interface FormEntitlements {
  pageIntervalMinutes: number;
  webIntervalMinutes: number | null;
  maxWebTopics: number;
  cloudRelay: boolean;
  emailAlerts: boolean;
}

export interface PreviewResult {
  ok: boolean;
  error?: { code: string; message: string };
  observation?: {
    title: string | null;
    price: number | null;
    currency: string | null;
    priceSource: string | null;
    availability: string;
    availabilitySource: string;
    selectorFound: boolean | null;
    httpStatus: number;
    finalUrl: string;
  };
}

export interface TopicPlan {
  condition: WebTopicCondition;
  queries: string[];
}

export interface SubmitResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

const AVAIL_LABEL: Record<string, string> = { in_stock: "En stock", out_of_stock: "En rupture", preorder: "Précommande", unknown: "Non détectée" };
const SOURCE_LABEL: Record<string, string> = {
  jsonld: "données produit structurées",
  microdata: "microdonnées de la page",
  meta: "balises meta",
  selector: "zone sélectionnée",
  text: "texte de la page (moins fiable)",
};
const INTENT_LABEL: Record<string, string> = {
  release_date: "Date de sortie",
  announcement: "Annonce",
  job_offer: "Offre (stage, emploi)",
  official_publication: "Publication officielle",
  generic: "Nouvelle information",
};

function intervalOptions(min: number): number[] {
  const base = [60, 120, 240, 360, 720, 1440, 2880, 10080];
  return [...new Set([min, ...base.filter((m) => m > min)])].sort((a, b) => a - b);
}

export function MonitorForm({
  entitlements,
  onPreview,
  onPlanTopic,
  onSubmit,
  upgradeHref,
  defaultKind = "page",
}: {
  entitlements: FormEntitlements;
  onPreview: (url: string, cssSelector?: string) => Promise<PreviewResult>;
  onPlanTopic: (request: string, officialDomains: string[]) => Promise<TopicPlan | null>;
  onSubmit: (input: CreateMonitorInput) => Promise<SubmitResult>;
  upgradeHref?: string;
  defaultKind?: "page" | "web_topic";
}) {
  const topicsAllowed = entitlements.maxWebTopics > 0 && entitlements.webIntervalMinutes !== null;
  const [kind, setKind] = React.useState<"page" | "web_topic">(topicsAllowed ? defaultKind : "page");
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [selector, setSelector] = React.useState("");
  const [preview, setPreview] = React.useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [condType, setCondType] = React.useState<PageCondition["type"]>("price_below");
  const [threshold, setThreshold] = React.useState("");
  const [minPercent, setMinPercent] = React.useState("0");
  const [sensitivity, setSensitivity] = React.useState<"any" | "significant">("significant");
  const [text, setText] = React.useState("");
  const [request, setRequest] = React.useState("");
  const [plan, setPlan] = React.useState<TopicPlan | null>(null);
  const [subject, setSubject] = React.useState("");
  const [requireOfficial, setRequireOfficial] = React.useState(true);
  const [domains, setDomains] = React.useState("");
  const [planning, setPlanning] = React.useState(false);
  const minInterval = kind === "web_topic" ? (entitlements.webIntervalMinutes ?? 1440) : entitlements.pageIntervalMinutes;
  const [interval, setInterval] = React.useState<number>(minInterval);
  const [executionMode, setExecutionMode] = React.useState<"auto" | "local_only" | "cloud_only">("auto");
  const [notifyEmail, setNotifyEmail] = React.useState(entitlements.emailAlerts);
  const [notifyDesktop, setNotifyDesktop] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => setInterval(minInterval), [minInterval]);

  const parsedDomains = domains
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
    .filter(Boolean)
    .slice(0, 5);

  async function analysePage() {
    setPreviewing(true);
    setPreview(null);
    const r = await onPreview(url.trim(), selector.trim() || undefined);
    setPreviewing(false);
    setPreview(r);
    const o = r.observation;
    if (o) {
      if (!name && o.title) setName(o.title.slice(0, 100));
      if (o.price !== null && !threshold) setThreshold(String(Math.floor(o.price * 0.9)));
      if (o.price === null && condType.startsWith("price")) setCondType(o.availability === "out_of_stock" ? "back_in_stock" : "page_changed");
    }
  }

  async function analyseTopic() {
    setPlanning(true);
    const p = await onPlanTopic(request.trim(), parsedDomains);
    setPlanning(false);
    if (p) {
      setPlan(p);
      setSubject(p.condition.subject);
      setRequireOfficial(p.condition.requireOfficial);
      if (!name) setName(p.condition.subject.slice(0, 100));
    }
  }

  function buildPageCondition(): PageCondition | null {
    switch (condType) {
      case "price_below": {
        const v = Number(threshold.replace(",", "."));
        if (!Number.isFinite(v) || v <= 0) {
          setErrors((e) => ({ ...e, threshold: "Indiquez un prix valide" }));
          return null;
        }
        return { type: "price_below", threshold: v, currency: "EUR" };
      }
      case "price_drop":
        return { type: "price_drop", minPercent: Math.max(0, Math.min(95, Number(minPercent) || 0)) };
      case "back_in_stock":
        return { type: "back_in_stock" };
      case "page_changed":
        return { type: "page_changed", sensitivity };
      case "text_appears":
      case "text_disappears":
        if (text.trim().length < 2) {
          setErrors((e) => ({ ...e, text: "Indiquez le texte à surveiller" }));
          return null;
        }
        return { type: condType, text: text.trim() };
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    let input: CreateMonitorInput;
    const notify = { inapp: true, email: notifyEmail && entitlements.emailAlerts, desktop: notifyDesktop };
    if (kind === "page") {
      const condition = buildPageCondition();
      if (!condition) return;
      if (!url.trim()) return setErrors({ url: "Adresse requise" });
      input = {
        kind: "page",
        name: name.trim() || url.trim().slice(0, 100),
        url: url.trim(),
        cssSelector: selector.trim() || undefined,
        renderMode: "auto",
        condition,
        intervalMinutes: interval,
        executionMode: entitlements.cloudRelay ? executionMode : "local_only",
        notify,
      };
    } else {
      if (request.trim().length < 5) return setErrors({ request: "Décrivez ce que vous recherchez" });
      const base = plan?.condition;
      input = {
        kind: "web_topic",
        name: name.trim() || subject || request.slice(0, 100),
        request: request.trim(),
        condition: {
          type: "web_topic",
          intent: base?.intent ?? "generic",
          subject: (subject || base?.subject || request).slice(0, 200),
          keywords: base?.keywords ?? [],
          requireOfficial,
        },
        officialDomains: parsedDomains,
        intervalMinutes: interval,
        notify,
      };
    }
    setSubmitting(true);
    const r = await onSubmit(input);
    setSubmitting(false);
    if (!r.ok) {
      setFormError(r.message ?? "La surveillance n'a pas pu être créée.");
      if (r.fieldErrors) setErrors(r.fieldErrors);
    }
  }

  const obs = preview?.observation;

  return (
    <form onSubmit={submit} className="flex flex-col gap-8" noValidate>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-base font-semibold">Que voulez-vous surveiller ?</legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Type de surveillance">
          {(
            [
              { k: "page", icon: <Globe />, title: "Une page précise", text: "Prix, stock, modification, apparition d'un texte." },
              { k: "web_topic", icon: <Search />, title: "Un sujet sur Internet", text: "Date de sortie, annonce, offre, publication officielle." },
            ] as const
          ).map((o) => {
            const disabled = o.k === "web_topic" && !topicsAllowed;
            return (
              <button
                key={o.k}
                type="button"
                role="radio"
                aria-checked={kind === o.k}
                disabled={disabled}
                onClick={() => setKind(o.k)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-5",
                  kind === o.k ? "border-gradient" : "border-line bg-white hover:border-line-strong",
                )}
              >
                <span className="mt-0.5 text-ink-soft">{o.icon}</span>
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 font-medium">
                    {o.title}
                    {disabled ? (
                      <Badge tone="neutral">
                        <Lock aria-hidden="true" /> Plus et +
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-sm text-muted-fg">{o.text}</span>
                </span>
              </button>
            );
          })}
        </div>
        {!topicsAllowed && upgradeHref ? (
          <p className="text-sm text-muted-fg">
            La recherche sur Internet est disponible à partir de la formule Plus.{" "}
            <a href={upgradeHref} className="text-blue underline-offset-4 hover:underline">
              Voir les formules
            </a>
          </p>
        ) : null}
      </fieldset>

      {kind === "page" ? (
        <section className="flex flex-col gap-5" aria-label="Page à surveiller">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field id="mf-url" label="Adresse de la page" required error={errors.url} className="flex-1">
              {(p) => <Input {...p} type="url" inputMode="url" placeholder="https://www.exemple.fr/produit" value={url} onChange={(e) => setUrl(e.target.value)} />}
            </Field>
            <Button type="button" variant="secondary" onClick={analysePage} loading={previewing} disabled={!/^https?:\/\/.+\..+/.test(url.trim())}>
              <ScanSearch aria-hidden="true" /> Analyser la page
            </Button>
          </div>
          {preview?.error ? (
            <Callout tone="warning" title="Analyse impossible" role="status">
              {preview.error.message}
            </Callout>
          ) : null}
          {obs ? (
            <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3" role="status" aria-live="polite">
              <div>
                <p className="text-xs text-muted-fg">Page</p>
                <p className="truncate text-sm font-medium">{obs.title ?? "Sans titre"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-fg">Prix détecté</p>
                <p className="font-display text-lg font-semibold">{obs.price !== null ? formatPrice(obs.price, obs.currency ?? "EUR") : "Non trouvé"}</p>
                {obs.priceSource ? <p className="text-[11px] text-muted-fg">Source : {SOURCE_LABEL[obs.priceSource] ?? obs.priceSource}</p> : null}
              </div>
              <div>
                <p className="text-xs text-muted-fg">Disponibilité</p>
                <p className="font-display text-lg font-semibold">{AVAIL_LABEL[obs.availability] ?? obs.availability}</p>
                {obs.selectorFound === false ? <p className="text-[11px] text-danger">Sélecteur introuvable sur la page</p> : null}
              </div>
            </div>
          ) : null}

          <Field id="mf-cond" label="M'alerter quand…">
            {(p) => (
              <Select {...p} value={condType} onChange={(e) => setCondType(e.target.value as PageCondition["type"])}>
                <option value="price_below">Le prix passe sous un seuil</option>
                <option value="price_drop">Le prix baisse</option>
                <option value="back_in_stock">Le produit revient en stock</option>
                <option value="page_changed">La page est modifiée</option>
                <option value="text_appears">Un texte apparaît</option>
                <option value="text_disappears">Un texte disparaît</option>
              </Select>
            )}
          </Field>
          {condType === "price_below" ? (
            <Field id="mf-threshold" label="Seuil de prix (€)" required error={errors.threshold}>
              {(p) => <Input {...p} inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="800" className="max-w-48" />}
            </Field>
          ) : null}
          {condType === "price_drop" ? (
            <Field id="mf-pct" label="Baisse minimale (%)" hint="0 = toute baisse de prix.">
              {(p) => <Input {...p} type="number" min={0} max={95} value={minPercent} onChange={(e) => setMinPercent(e.target.value)} className="max-w-32" />}
            </Field>
          ) : null}
          {condType === "page_changed" ? (
            <Field id="mf-sens" label="Sensibilité">
              {(p) => (
                <Select {...p} value={sensitivity} onChange={(e) => setSensitivity(e.target.value as "any" | "significant")}>
                  <option value="significant">Changements significatifs (plus de 2 % du contenu)</option>
                  <option value="any">Toute modification du texte</option>
                </Select>
              )}
            </Field>
          ) : null}
          {condType === "text_appears" || condType === "text_disappears" ? (
            <Field id="mf-text" label="Texte à surveiller" required error={errors.text}>
              {(p) => <Input {...p} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Inscriptions ouvertes" />}
            </Field>
          ) : null}
          <details className="rounded-xl border border-line p-4">
            <summary className="cursor-pointer text-sm font-medium">Options avancées</summary>
            <div className="mt-4 flex flex-col gap-4">
              <Field id="mf-sel" label="Zone de la page (sélecteur CSS)" hint="Facultatif. Ex. : #prix-principal ou .product-price">
                {(p) => <Input {...p} value={selector} maxLength={300} onChange={(e) => setSelector(e.target.value)} placeholder="#prix" />}
              </Field>
              {entitlements.cloudRelay ? (
                <Field id="mf-exec" label="Exécution des contrôles">
                  {(p) => (
                    <Select {...p} value={executionMode} onChange={(e) => setExecutionMode(e.target.value as typeof executionMode)}>
                      <option value="auto">Mon ordinateur en priorité, serveurs en relais</option>
                      <option value="local_only">Uniquement sur mon ordinateur</option>
                      <option value="cloud_only">Uniquement sur les serveurs Waverti</option>
                    </Select>
                  )}
                </Field>
              ) : (
                <p className="text-sm text-muted-fg">Les contrôles s'exécutent sur votre ordinateur, quand l'application Waverti est ouverte.</p>
              )}
            </div>
          </details>
        </section>
      ) : (
        <section className="flex flex-col gap-5" aria-label="Recherche sur Internet">
          <Field id="mf-request" label="Votre demande" required error={errors.request} hint="Ex. : « Préviens-moi dès que la date de sortie officielle de Projet Aurora est annoncée »">
            {(p) => <Textarea {...p} rows={3} maxLength={500} value={request} onChange={(e) => setRequest(e.target.value)} />}
          </Field>
          <Field id="mf-domains" label="Sites officiels connus (facultatif)" hint="Domaines séparés par des virgules, ex. : editeur.com. Leurs publications sont considérées comme officielles.">
            {(p) => <Input {...p} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="editeur.com" />}
          </Field>
          <div>
            <Button type="button" variant="secondary" onClick={analyseTopic} loading={planning} disabled={request.trim().length < 5}>
              <Sparkles aria-hidden="true" /> Analyser la demande
            </Button>
          </div>
          {plan ? (
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4" role="status" aria-live="polite">
              <p className="text-sm">
                Type détecté : <Badge tone="info">{INTENT_LABEL[plan.condition.intent]}</Badge>
              </p>
              <Field id="mf-subject" label="Sujet précis" hint="Vérifiez et corrigez si besoin : c'est ce que Waverti recherche.">
                {(p) => <Input {...p} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />}
              </Field>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="mf-official">N'alerter que si une source officielle le confirme</Label>
                <Switch id="mf-official" checked={requireOfficial} onCheckedChange={setRequireOfficial} />
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-muted-fg">Requêtes prévues ({plan.queries.length})</summary>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-fg">
                  {plan.queries.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
          <p className="text-xs text-muted-fg">
            Waverti interroge un moteur de recherche et examine les pages publiques accessibles : il ne peut pas explorer tout Internet et
            n'invente jamais d'information manquante.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-5 border-t border-line pt-6" aria-label="Réglages">
        <Field id="mf-name" label="Nom de la surveillance" required>
          {(p) => <Input {...p} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Ordinateur portable" />}
        </Field>
        <Field id="mf-interval" label="Fréquence de vérification" hint={`Fréquence maximale de votre formule : ${formatInterval(minInterval)}.`}>
          {(p) => (
            <Select {...p} value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
              {intervalOptions(minInterval).map((m) => (
                <option key={m} value={m}>
                  {formatInterval(m).replace(/^./, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Notifications</legend>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked disabled aria-label="Dans l'application (toujours actif)" /> Dans l'application (toujours actif)
          </label>
          <label className={cn("flex items-center gap-3 text-sm", !entitlements.emailAlerts && "text-muted-fg")}>
            <Checkbox checked={notifyEmail && entitlements.emailAlerts} disabled={!entitlements.emailAlerts} onCheckedChange={(v) => setNotifyEmail(v === true)} />
            Par e-mail {!entitlements.emailAlerts ? "(à partir de la formule Plus)" : ""}
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={notifyDesktop} onCheckedChange={(v) => setNotifyDesktop(v === true)} /> Notification sur le bureau (application installée)
          </label>
        </fieldset>
      </section>

      {formError ? (
        <Callout tone="danger" role="alert">
          {formError}
        </Callout>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" size="lg" loading={submitting}>
          Créer la surveillance
        </Button>
      </div>
    </form>
  );
}
