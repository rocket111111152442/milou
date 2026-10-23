"use client";

import { CheckCircle2, Download, Loader2, Plus, Trash2, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DAYS } from "@/lib/format";
import type { Settings } from "@/lib/types";
import { api, Card, confirmAction, Label, NumberField, PageHeader, SaveBar, TextArea, TextField, toast, Toggle, useDocEditor } from "../ui";

export type Integrations = {
  storage: string;
  persistent: boolean;
  stripe: boolean;
  stripeMode: "test" | "live" | null;
  webhook: boolean;
  resend: boolean;
  blob: boolean;
  siteUrl: string;
  defaultPassword: boolean;
};

function Status({ ok, label, help }: { ok: boolean; label: string; help: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-noir/[0.07] p-3">
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-noir/30" />}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-noir/50">{help}</p>
      </div>
    </div>
  );
}

export function SettingsEditor({ initial, integrations }: { initial: Settings; integrations: Integrations }) {
  const router = useRouter();
  const { doc, setDoc, patch, dirty, saving, save, reset } = useDocEditor("settings", initial);
  const [busy, setBusy] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const sub = <K extends keyof Settings>(k: K, field: string, v: unknown) => setDoc((d) => ({ ...d, [k]: { ...(d[k] as object), [field]: v } }));
  const hours = [1, 2, 3, 4, 5, 6, 0].map((day) => doc.hours.find((h) => h.day === day) || { day, closed: true, ranges: [] });
  const setDay = (day: number, v: Partial<Settings["hours"][number]>) => setDoc((d) => ({ ...d, hours: [1, 2, 3, 4, 5, 6, 0].map((x) => { const h = d.hours.find((y) => y.day === x) || { day: x, closed: true, ranges: [] }; return x === day ? { ...h, ...v } : h; }) }));

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(null);
  }

  return (
    <div className="pb-24">
      <PageHeader title="Paramètres" subtitle="Informations de la boutique, horaires, annonces, paiement, sauvegardes" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="La boutique">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nom" value={doc.shopName} onChange={(v) => patch("shopName", v)} />
            <TextField label="Accroche" value={doc.tagline} onChange={(v) => patch("tagline", v)} />
            <TextField label="Raison sociale" value={doc.legalName} onChange={(v) => patch("legalName", v)} />
            <TextField label="SIRET" value={doc.siret} onChange={(v) => patch("siret", v)} />
            <TextField label="Téléphone" value={doc.phone} onChange={(v) => patch("phone", v)} />
            <TextField label="E-mail public" type="email" value={doc.email} onChange={(v) => patch("email", v)} />
            <TextField className="sm:col-span-2" label="Adresse" value={doc.address} onChange={(v) => patch("address", v)} />
            <TextField label="Code postal" value={doc.postcode} onChange={(v) => patch("postcode", v)} />
            <TextField label="Ville" value={doc.city} onChange={(v) => patch("city", v)} />
            <TextField className="sm:col-span-2" label="Lien Google Maps" value={doc.mapsUrl} onChange={(v) => patch("mapsUrl", v)} />
            <TextField label="Instagram" value={doc.instagram} onChange={(v) => patch("instagram", v)} />
            <TextField label="Facebook" value={doc.facebook} onChange={(v) => patch("facebook", v)} />
            <NumberField label="Note Google" step={0.1} value={doc.googleRating} onChange={(v) => patch("googleRating", v ?? 0)} />
            <NumberField label="Nombre d'avis Google" value={doc.googleReviews} onChange={(v) => patch("googleReviews", v ?? 0)} />
          </div>
        </Card>

        <Card title="Horaires d'ouverture">
          <div className="space-y-2">
            {hours.map((h) => (
              <div key={h.day} className="grid grid-cols-[90px_auto_1fr] items-center gap-3">
                <span className="text-sm font-medium">{DAYS[h.day]}</span>
                <button onClick={() => setDay(h.day, { closed: !h.closed, ranges: h.closed && !h.ranges.length ? [{ from: "09:00", to: "12:30" }] : h.ranges })} className={cn("rounded-lg px-2 py-1 text-xs", h.closed ? "bg-noir/10 text-noir/50" : "bg-emerald-50 text-emerald-700")}>
                  {h.closed ? "Fermé" : "Ouvert"}
                </button>
                {!h.closed && (
                  <div className="flex flex-wrap items-center gap-2">
                    {h.ranges.map((r, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <input type="time" value={r.from} onChange={(e) => setDay(h.day, { ranges: h.ranges.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })} className="adm-input !w-auto !py-1" aria-label="Ouverture" />
                        –
                        <input type="time" value={r.to} onChange={(e) => setDay(h.day, { ranges: h.ranges.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })} className="adm-input !w-auto !py-1" aria-label="Fermeture" />
                        <button onClick={() => setDay(h.day, { ranges: h.ranges.filter((_, j) => j !== i) })} className="p-1 text-noir/30 hover:text-red-600" aria-label="Retirer la plage">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                    {h.ranges.length < 3 && (
                      <button onClick={() => setDay(h.day, { ranges: [...h.ranges, { from: "15:00", to: "19:00" }] })} className="rounded-lg p-1 text-noir/40 hover:text-aubergine-600" aria-label="Ajouter une plage">
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Label help="vacances, inventaire…">Fermetures exceptionnelles</Label>
            <div className="space-y-2">
              {doc.closures.map((c, i) => (
                <div key={c.id} className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
                  <input type="date" value={c.from} onChange={(e) => patch("closures", doc.closures.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} className="adm-input" aria-label="Du" />
                  <input type="date" value={c.to} onChange={(e) => patch("closures", doc.closures.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} className="adm-input" aria-label="Au" />
                  <input value={c.label} onChange={(e) => patch("closures", doc.closures.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="adm-input" placeholder="Congés d'hiver" aria-label="Motif" />
                  <button onClick={() => patch("closures", doc.closures.filter((_, j) => j !== i))} className="p-2 text-noir/30 hover:text-red-600" aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => patch("closures", [...doc.closures, { id: `cl_${Date.now().toString(36)}`, from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), label: "Fermeture exceptionnelle" }])} className="adm-btn adm-btn-ghost !text-xs">
                <Plus className="h-3.5 w-3.5" /> Ajouter une fermeture
              </button>
            </div>
          </div>
        </Card>

        <Card title="Annonce, intro & maintenance">
          <div className="space-y-4">
            <Toggle label="Bandeau d'annonce en haut du site" checked={doc.announcement.active} onChange={(v) => sub("announcement", "active", v)} />
            <TextField label="Texte de l'annonce" value={doc.announcement.text} onChange={(v) => sub("announcement", "text", v)} />
            <TextField label="Lien de l'annonce" value={doc.announcement.link} onChange={(v) => sub("announcement", "link", v)} />
            <Toggle label="Animation d'introduction (5 s)" checked={doc.intro.enabled} onChange={(v) => sub("intro", "enabled", v)} />
            <Toggle label="Une seule fois par visite" help="sinon à chaque rechargement" checked={doc.intro.oncePerSession} onChange={(v) => sub("intro", "oncePerSession", v)} />
            <Toggle label="Mode maintenance" help="le site affiche un message ; vous restez connectée" checked={doc.maintenance.enabled} onChange={(v) => sub("maintenance", "enabled", v)} />
            <TextField label="Message de maintenance" value={doc.maintenance.message} onChange={(v) => sub("maintenance", "message", v)} />
          </div>
        </Card>

        <Card title="Référencement & notifications">
          <div className="space-y-4">
            <TextField label="Titre Google" value={doc.seo.title} onChange={(v) => sub("seo", "title", v)} />
            <TextArea label="Description Google" rows={3} value={doc.seo.description} onChange={(v) => sub("seo", "description", v)} />
            <TextField label="E-mail qui reçoit les commandes et messages" type="email" value={doc.notifyEmail} onChange={(v) => patch("notifyEmail", v)} />
            <Toggle label="Autoriser le paiement en boutique" help="pour le retrait et le Drive" checked={doc.allowPayInStore} onChange={(v) => patch("allowPayInStore", v)} />
          </div>
        </Card>

        <Card title="Connexions" className="lg:col-span-2">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Status ok={integrations.persistent} label={`Base de données : ${integrations.storage}`} help={integrations.persistent ? "Les données sont conservées." : "Ajoutez Upstash Redis (Vercel → Storage) : UPSTASH_REDIS_REST_URL / TOKEN."} />
            <Status ok={integrations.stripe} label={`Stripe ${integrations.stripeMode ? `(${integrations.stripeMode === "live" ? "production" : "test"})` : ""}`} help={integrations.stripe ? "Paiements en ligne actifs." : "STRIPE_SECRET_KEY manquante : commandes en mode démo."} />
            <Status ok={integrations.webhook} label="Webhook Stripe" help={integrations.webhook ? "Confirmations automatiques actives." : `STRIPE_WEBHOOK_SECRET manquant — endpoint : ${integrations.siteUrl}/api/stripe/webhook`} />
            <Status ok={integrations.resend} label="E-mails (Resend)" help={integrations.resend ? "Confirmations et alertes envoyées." : "RESEND_API_KEY manquante : aucun e-mail n'est envoyé."} />
            <Status ok={integrations.blob} label="Stockage d'images (Vercel Blob)" help={integrations.blob ? "Photos hébergées sur Vercel Blob." : "Sans BLOB_READ_WRITE_TOKEN, les photos sont stockées compressées dans la base."} />
            <Status ok={!integrations.defaultPassword} label="Mot de passe personnalisé" help={integrations.defaultPassword ? "Définissez ADMIN_PASSWORD et AUTH_SECRET." : "Accès protégé."} />
          </div>
        </Card>

        <Card title="Sauvegarde & démonstration" className="lg:col-span-2">
          <div className="flex flex-wrap gap-3">
            <a href="/api/admin/backup" className="adm-btn adm-btn-ghost">
              <Download className="h-4 w-4" /> Télécharger une sauvegarde
            </a>
            <button onClick={() => file.current?.click()} className="adm-btn adm-btn-ghost" disabled={!!busy}>
              {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Restaurer une sauvegarde
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f || !confirmAction("Remplacer toutes les données actuelles par cette sauvegarde ?")) return;
                run("import", async () => {
                  await api("/api/admin/backup", { body: JSON.parse(await f.text()) });
                  toast.ok("Sauvegarde restaurée");
                  router.refresh();
                });
              }}
            />
            <button
              onClick={() =>
                run("demo", async () => {
                  const r = await api<{ created: number }>("/api/admin/demo-orders", { body: {} });
                  toast.ok(`${r.created} commandes de démonstration créées`);
                  router.refresh();
                })
              }
              className="adm-btn adm-btn-ghost"
              disabled={!!busy}
            >
              {busy === "demo" && <Loader2 className="h-4 w-4 animate-spin" />} Générer des commandes de démo
            </button>
            <button
              onClick={() =>
                run("undemo", async () => {
                  const r = await api<{ removed: number }>("/api/admin/demo-orders", { method: "DELETE" });
                  toast.ok(`${r.removed} commandes de démo supprimées`);
                  router.refresh();
                })
              }
              className="adm-btn adm-btn-ghost"
              disabled={!!busy}
            >
              Supprimer les commandes de démo
            </button>
            <button
              onClick={() => {
                const c = window.prompt("Tout réinitialiser (catalogue, textes, commandes) ? Tapez REINITIALISER pour confirmer.");
                if (c !== "REINITIALISER") return;
                run("reset", async () => {
                  await api("/api/admin/reset", { body: { confirm: c } });
                  toast.ok("Données réinitialisées");
                  window.location.reload();
                });
              }}
              className="adm-btn adm-btn-danger"
              disabled={!!busy}
            >
              Réinitialiser le site
            </button>
          </div>
        </Card>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
