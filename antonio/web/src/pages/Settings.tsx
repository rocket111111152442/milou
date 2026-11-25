import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  MAIL_CATEGORIES,
  MAIL_CATEGORY_LABELS,
  formatUsdFromMicros,
  type AutonomyLevel,
  type Capability,
  type Category,
  type ConnectionDTO,
  type ConnectorDescriptor,
} from "@antonio/shared";
import { api, queryClient, uid } from "../lib/api";
import { fmtDateTime, fmtRelative } from "../lib/format";
import { useApp } from "../lib/app-state";
import { Card, DemoBadge, Disclosure, Empty, Loading, PageHead } from "../components/ui";
import { RuleProposal } from "../components/panels";
import { AutonomyEditor } from "./Onboarding";

// ---------------------------------------------------------------------------
// Connexions
// ---------------------------------------------------------------------------

interface ConnectorsResp {
  connectors: ConnectorDescriptor[];
  setup: { google: boolean; microsoft: boolean; openai: boolean; redirectUris: { google: string; microsoft: string }; webhooks: { gmailPubSub: boolean; httpsPublicUrl: boolean } };
}

const DEFAULT_CAPS: Capability[] = ["mail.read", "mail.draft", "calendar.read"];

export function ConnectButtons() {
  const { toast } = useApp();
  const q = useQuery({ queryKey: ["connectors"], queryFn: () => api<ConnectorsResp>("/api/connectors") });
  const [caps, setCaps] = useState<Capability[]>(DEFAULT_CAPS);
  const authorize = useMutation({
    mutationFn: (provider: "google" | "microsoft") => api<{ url: string }>(`/api/connections/${provider}/authorize`, { body: { capabilities: caps } }),
    onSuccess: (r) => (window.location.href = r.url),
    onError: (e: Error) => toast(e.message),
  });
  const demo = useMutation({
    mutationFn: () => api("/api/connections/demo", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast("Compte de démonstration connecté (données fictives).");
    },
  });
  if (q.isError) return <p role="alert">Connexion indisponible. <button className="btn small" onClick={() => void q.refetch()}>Réessayer</button></p>;
  if (!q.data) return <Loading />;
  const s = q.data.setup;
  return <div className="stack-16">
    <div className="provider-grid">
      {(["google", "microsoft"] as const).map(provider => <div className="provider-tile" key={provider}>
        <span className={`provider-mark ${provider}`} aria-hidden="true">{provider === "google" ? "G" : "▦"}</span>
        <div className="grow"><strong>{provider === "google" ? "Google" : "Outlook"}</strong><p className="small muted">E-mails et agenda</p></div>
        <button className="btn primary small" disabled={!s[provider] || authorize.isPending || caps.length === 0} onClick={() => authorize.mutate(provider)}>{s[provider] ? "Connecter" : "Bientôt"}<span className="sr-only"> {provider === "google" ? "Google" : "Outlook"}</span></button>
      </div>)}
    </div>
    <Disclosure title="Choisir les autorisations">
      <p className="small muted">Modifiables à tout moment.</p>
      <div className="permission-list">{CAPABILITIES.filter(c => c !== "mail.delete_permanent").map(c => <label className="check" key={c}><input type="checkbox" checked={caps.includes(c)} onChange={() => setCaps(x => x.includes(c) ? x.filter(y => y !== c) : [...x, c])} />{CAPABILITY_LABELS[c]}</label>)}</div>
      {caps.includes("mail.draft") && <p className="tiny muted">Chez Google, les brouillons incluent aussi le droit d’envoi. Waverti exige votre validation ou une règle confirmée pour envoyer.</p>}
    </Disclosure>
    <button className="btn ghost small demo-link" onClick={() => demo.mutate()} disabled={demo.isPending}>Essayer avec des données fictives</button>
    {demo.isError && <p role="alert" className="small">La démonstration n’a pas pu être chargée. Réessayez.</p>}
  </div>;
}

export function ConnectionsPage() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get("connected")) toast("Compte connecté. Première synchronisation en cours.");
    if (params.get("error")) toast(`Connexion impossible : ${params.get("error")}`);
    if (params.get("connected") || params.get("error")) setParams({}, { replace: true });
  }, [params, setParams, toast]);
  const conns = useQuery({ queryKey: ["connections"], queryFn: () => api<{ connections: ConnectionDTO[] }>("/api/connections") });
  const sync = useMutation({
    mutationFn: (id: string) => api(`/api/connections/${id}/sync-now`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries(),
    onError: (e: Error) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/connections/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast("Connexion révoquée et données locales supprimées.");
    },
  });
  const extend = useMutation({
    mutationFn: (v: { c: ConnectionDTO; cap: Capability }) => api<{ url: string }>(`/api/connections/${v.c.provider}/authorize`, { body: { capabilities: [v.cap], connectionId: v.c.id } }),
    onSuccess: (r) => (window.location.href = r.url),
    onError: (e: Error) => toast(e.message),
  });
  return <div className="page connections-page stack-16">
    <PageHead title="Vos connexions" subtitle="Retrouvez vos e-mails et agendas ici." />
    {conns.isLoading ? <Loading /> : conns.isError ? <Card><div className="card-body row wrap" role="alert">Vos comptes n’ont pas pu être chargés.<button className="btn small" onClick={() => void conns.refetch()}>Réessayer</button></div></Card> : conns.data?.connections.map(c => <Card key={c.id}>
      <div className="card-body stack-16">
        <div className="connected-heading">
          <span className={`provider-mark ${c.provider}`} aria-hidden="true">{c.isDemo ? "✦" : c.provider === "google" ? "G" : "▦"}</span>
          <div className="grow account-identity"><strong>{c.accountEmail}</strong><p className="small muted">{c.providerLabel}{c.lastSyncAt ? ` · Mis à jour ${fmtRelative(c.lastSyncAt)}` : " · Synchronisation en attente"}</p></div>
          {c.isDemo && <DemoBadge />}
          <span className={`badge ${c.status === "active" ? "ok" : "wait"}`}>{c.status === "active" ? "Connecté" : c.status === "expired" ? "À reconnecter" : "À vérifier"}</span>
        </div>
        {c.lastError && <p className="small" role="alert">La synchronisation a rencontré un problème. Réessayez ou reconnectez ce compte.</p>}
        <div className="row wrap">
          {c.status !== "active" && !c.isDemo && <button className="btn primary small" disabled={extend.isPending} onClick={() => extend.mutate({ c, cap: c.capabilities[0] ?? "mail.read" })}>Reconnecter</button>}
          <button className="btn small" onClick={() => sync.mutate(c.id)} disabled={sync.isPending}>{sync.isPending ? "Actualisation…" : "Actualiser"}</button>
        </div>
        <Disclosure title="Gérer les accès">
          <div className="permission-list">{CAPABILITIES.map(cap => {
            const has = c.capabilities.includes(cap);
            return <div key={cap} className="spread permission-row"><span className="small">{CAPABILITY_LABELS[cap]}</span>{has ? <span className="badge ok">Autorisé</span> : !c.isDemo && cap !== "mail.delete_permanent" ? <button className="btn small" disabled={extend.isPending} onClick={() => extend.mutate({ c, cap })}>Autoriser<span className="sr-only"> {CAPABILITY_LABELS[cap]}</span></button> : <span className="small muted">Non autorisé</span>}</div>;
          })}</div>
          {c.lastError && <Disclosure title="Détail du problème"><p className="small connection-error">{c.lastError}</p></Disclosure>}
          <button className="btn ghost danger small" disabled={remove.isPending} onClick={() => { if (confirm(`Déconnecter ${c.accountEmail} ? Les autorisations seront révoquées et les données locales de ce compte supprimées.`)) remove.mutate(c.id); }}>Déconnecter ce compte</button>
        </Disclosure>
      </div>
    </Card>)}
    <Card title="Ajouter un compte"><div className="card-body"><ConnectButtons /></div></Card>
    <Link to="/integrations" className="connections-more">Voir les autres intégrations <span aria-hidden="true">→</span></Link>
  </div>;
}

// ---------------------------------------------------------------------------
// Profil, préférences, mémoire, confidentialité
// ---------------------------------------------------------------------------

export function ProfilePage() {
  const { toast } = useApp();
  const q = useQuery({ queryKey: ["profile"], queryFn: () => api<{ profile: Record<string, unknown>; autonomy: Record<Category, AutonomyLevel> }>("/api/profile") });
  const mem = useQuery({ queryKey: ["memories"], queryFn: () => api<{ memories: { id: string; content: string; status: string; createdAt: string }[] }>("/api/memories") });
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [newMem, setNewMem] = useState("");
  useEffect(() => {
    if (q.data && !form) setForm(q.data.profile);
  }, [q.data, form]);
  const save = useMutation({
    mutationFn: () =>
      api("/api/profile", {
        method: "PUT",
        body: {
          firstName: form!.firstName ?? "",
          assistantName: form!.assistantName,
          company: form!.company ?? "",
          jobRole: form!.jobRole ?? "",
          timezone: form!.timezone,
          workStart: form!.workStart,
          workEnd: form!.workEnd,
          tone: form!.tone,
          tutoiement: form!.tutoiement,
          signature: form!.signature ?? null,
          briefingTime: form!.briefingTime,
          transcriptRetentionDays: Number(form!.transcriptRetentionDays),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast("Préférences enregistrées.");
    },
    onError: (e: Error) => toast(e.message),
  });
  const setAut = useMutation({
    mutationFn: (v: Record<Category, AutonomyLevel>) => {
      const changed = (Object.keys(v) as Category[]).find((k) => v[k] !== q.data!.autonomy[k]);
      return changed ? api("/api/autonomy", { method: "PUT", body: { category: changed, level: v[changed] } }) : Promise.resolve(null);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
  const memAdd = useMutation({ mutationFn: () => api("/api/memories", { body: { content: newMem } }), onSuccess: () => { setNewMem(""); void queryClient.invalidateQueries({ queryKey: ["memories"] }); } });
  const memDel = useMutation({ mutationFn: (id: string) => api(`/api/memories/${id}`, { method: "DELETE" }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["memories"] }) });
  const memConfirm = useMutation({ mutationFn: (id: string) => api(`/api/memories/${id}/confirm`, { method: "POST" }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["memories"] }) });
  const clearTranscripts = useMutation({ mutationFn: () => api("/api/assistant/conversations", { method: "DELETE" }), onSuccess: () => toast("Transcriptions effacées.") });
  const delAccount = useMutation({
    mutationFn: (password: string) => api("/api/account", { method: "DELETE", body: { password } }),
    onSuccess: () => (window.location.href = "/connexion"),
    onError: (e: Error) => toast(e.message),
  });
  if (!form || !q.data) return <div className="page"><Loading /></div>;
  const f = (k: string) => ({ value: (form[k] as string) ?? "", onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <div className="page stack-16">
      <PageHead title="Vos préférences" subtitle="Un assistant à votre façon." />
      <Card title="Identité et style">
        <div className="card-body stack-12">
          <div className="grid-2">
            <div className="field"><label htmlFor="fn">Prénom</label><input id="fn" className="input" {...f("firstName")} /></div>
            <div className="field"><label htmlFor="an">Prénom de l'assistant</label><input id="an" className="input" {...f("assistantName")} /></div>
            <div className="field"><label htmlFor="co">Entreprise</label><input id="co" className="input" {...f("company")} /></div>
            <div className="field"><label htmlFor="jr">Rôle</label><input id="jr" className="input" {...f("jobRole")} /></div>
            <div className="field"><label htmlFor="to">Ton des réponses</label><input id="to" className="input" {...f("tone")} /></div>
          </div>
          <label className="check"><input type="checkbox" checked={Boolean(form.tutoiement)} onChange={(e) => setForm({ ...form, tutoiement: e.target.checked })} /> Me tutoyer</label>
          <Disclosure title="Signature et horaires">
            <div className="field"><label htmlFor="sig">Signature des e-mails</label><textarea id="sig" className="textarea" {...f("signature")} /></div>
            <div className="grid-2">
              <div className="field"><label htmlFor="tz">Fuseau horaire</label><input id="tz" className="input" {...f("timezone")} /></div>
              <div className="field"><label htmlFor="bt">Heure du point quotidien</label><input id="bt" type="time" className="input" {...f("briefingTime")} /></div>
              <div className="field"><label htmlFor="ws">Début de journée</label><input id="ws" type="time" className="input" {...f("workStart")} /></div>
              <div className="field"><label htmlFor="we">Fin de journée</label><input id="we" type="time" className="input" {...f("workEnd")} /></div>
              <div className="field"><label htmlFor="rt">Historique vocal : jours conservés</label><input id="rt" type="number" min={0} max={365} className="input" {...f("transcriptRetentionDays")} /><span className="tiny muted">0 pour ne rien conserver.</span></div>
            </div>
          </Disclosure>
          <button className="btn primary" onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</button>
        </div>
      </Card>
      <Card title="Ce que l’assistant peut faire seul" collapsible>
        <div className="card-body stack-12">
          <p className="small muted">Une règle confirmée est nécessaire. En cas d’exception, l’assistant attend votre validation.</p>
          <AutonomyEditor value={q.data.autonomy} onChange={(v) => setAut.mutate(v)} />
        </div>
      </Card>
      <Card title="Ce que l’assistant retient de vous" collapsible>
        <div className="card-body stack-12">
          <p className="small muted">Les préférences à garder pour la prochaine fois.</p>
          {mem.data?.memories.length ? (
            <ul className="list">
              {mem.data.memories.map((m) => (
                <li key={m.id} className="spread" style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                  <span className="small">{m.content} {m.status === "proposed" && <span className="badge wait">proposée</span>}</span>
                  <span className="row">
                    {m.status === "proposed" && <button className="btn small" onClick={() => memConfirm.mutate(m.id)}>Retenir</button>}
                    <button className="btn ghost small danger" onClick={() => memDel.mutate(m.id)}>Supprimer</button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Rien pour l'instant.</p>
          )}
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (newMem.trim()) memAdd.mutate(); }}>
            <input className="input" value={newMem} onChange={(e) => setNewMem(e.target.value)} placeholder="ex. Ne jamais proposer de rendez-vous le vendredi après-midi" aria-label="Nouvelle préférence" />
            <button className="btn" type="submit">Ajouter</button>
          </form>
        </div>
      </Card>
      <Card title="Vos données" collapsible>
        <div className="card-body stack-12">
          <p className="small">Waverti conserve les métadonnées des messages (expéditeur, objet, extrait) et lit leur contenu à la demande chez le fournisseur ; il n'en garde pas de copie intégrale. Les jetons d'accès sont chiffrés.</p>
          <div className="row wrap">
            <a className="btn" href="/api/account/export">Exporter mes données</a>
            <button className="btn" onClick={() => clearTranscripts.mutate()}>Effacer les transcriptions</button>
            <button
              className="btn ghost danger"
              onClick={() => {
                const pw = prompt("Pour supprimer définitivement votre compte, saisissez votre mot de passe :");
                if (pw) delAccount.mutate(pw);
              }}
            >
              Supprimer mon compte
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modèles
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  approved: boolean;
}

export function TemplatesPage() {
  const q = useQuery({ queryKey: ["templates"], queryFn: () => api<{ templates: Template[] }>("/api/templates") });
  const [edit, setEdit] = useState<Partial<Template> | null>(null);
  const save = useMutation({
    mutationFn: (t: Partial<Template>) => (t.id ? api(`/api/templates/${t.id}`, { method: "PUT", body: { name: t.name, subject: t.subject ?? null, body: t.body } }) : api("/api/templates", { body: { name: t.name, subject: t.subject ?? null, body: t.body } })),
    onSuccess: () => {
      setEdit(null);
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
  const approve = useMutation({ mutationFn: (v: { id: string; approved: boolean }) => api(`/api/templates/${v.id}/approve`, { body: { approved: v.approved } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["templates"] }) });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/templates/${id}`, { method: "DELETE" }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["templates"] }) });
  return (
    <div className="page stack-16">
      <PageHead
        title="Modèles de messages"
        subtitle="Vos réponses types, prêtes à réutiliser."
        actions={<button className="btn primary" onClick={() => setEdit({ name: "", body: "Bonjour {{prenom}},\n\n\n\n{{signature}}" })}>Nouveau modèle</button>}
      />
      {edit && (
        <Card title={edit.id ? "Modifier le modèle" : "Nouveau modèle"}>
          <div className="card-body stack-12">
            <div className="field"><label htmlFor="tn">Nom</label><input id="tn" className="input" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="tb">Texte</label><textarea id="tb" className="textarea" rows={8} value={edit.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
            <p className="tiny muted">Variables : {"{{prenom}}, {{signature}}, {{mon_prenom}}"}. Approuvez un modèle pour l’utiliser dans les réponses automatiques.</p>
            {edit.id && <p className="tiny muted">Modifier un modèle retire son approbation : il faudra le relire.</p>}
            <div className="row">
              <button className="btn primary" onClick={() => save.mutate(edit)} disabled={!edit.name || !edit.body}>Enregistrer</button>
              <button className="btn ghost" onClick={() => setEdit(null)}>Annuler</button>
            </div>
          </div>
        </Card>
      )}
      {q.data?.templates.length === 0 && <Card><Empty>Aucun modèle.</Empty></Card>}
      {q.data?.templates.map((t) => (
        <Card key={t.id} title={t.name} actions={<span className={`badge ${t.approved ? "ok" : "wait"}`}>{t.approved ? "Approuvé" : "À relire"}</span>}>
          <div className="card-body stack-12">
            <div className="mail-body small">{t.body}</div>
            <div className="row">
              <button className="btn small" onClick={() => approve.mutate({ id: t.id, approved: !t.approved })}>{t.approved ? "Retirer l'approbation" : "Approuver"}</button>
              <button className="btn ghost small" onClick={() => setEdit(t)}>Modifier</button>
              <button className="btn ghost small danger" onClick={() => del.mutate(t.id)}>Supprimer</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Règles
// ---------------------------------------------------------------------------

interface Rule {
  id: string;
  name: string;
  status: string;
  category: string;
  scopeDescription: string;
  confirmedAt: string | null;
}

export function RulesPage() {
  const { toast } = useApp();
  const q = useQuery({ queryKey: ["rules"], queryFn: () => api<{ rules: Rule[] }>("/api/rules") });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => api<{ templates: Template[] }>("/api/templates") });
  const [draft, setDraft] = useState<{ name: string; field: string; value: string; category: string; meeting: boolean; action: string; templateId: string; label: string } | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => {
      const d = draft!;
      const conditions: Record<string, unknown> = {};
      const values = d.value.split(",").map((s) => s.trim()).filter(Boolean);
      if (values.length) conditions[d.field] = values;
      if (d.category) conditions.categories = [d.category];
      if (d.meeting) conditions.meetingRequest = true;
      const action =
        d.action === "reply_template"
          ? { type: "reply_template", templateId: d.templateId }
          : d.action === "propose_slots"
            ? { type: "propose_slots", durationMin: 30, daysAhead: 7, count: 3 }
            : d.action === "label"
              ? { type: "label", label: d.label || "Waverti" }
              : { type: d.action };
      return api<{ rule: Rule }>("/api/rules", { body: { name: d.name, conditions, action } });
    },
    onSuccess: (r) => {
      setDraft(null);
      setShown(r.rule.id);
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (e: Error) => toast(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: string }) => api(`/api/rules/${v.id}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }),
    onError: (e: Error) => toast(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/rules/${id}`, { method: "DELETE" }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }) });
  return (
    <div className="page stack-16">
      <PageHead
        title="Règles d'automatisation"
        subtitle="Vos règles pour automatiser les tâches répétitives."
        actions={<button className="btn primary" onClick={() => setDraft({ name: "", field: "fromDomains", value: "", category: "", meeting: false, action: "label", templateId: "", label: "" })}>Nouvelle règle</button>}
      />
      {draft && (
        <Card title="Nouvelle règle">
          <div className="card-body stack-12">
            <div className="field"><label htmlFor="rn">Nom</label><input id="rn" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="rf">Quand le message…</label>
                <select id="rf" className="select" value={draft.field} onChange={(e) => setDraft({ ...draft, field: e.target.value })}>
                  <option value="fromDomains">vient du domaine</option>
                  <option value="fromEmails">vient de l'adresse</option>
                  <option value="subjectContains">a un objet contenant</option>
                  <option value="textContains">contient le texte</option>
                </select>
              </div>
              <div className="field"><label htmlFor="rv">Valeur(s), séparées par des virgules</label><input id="rv" className="input" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></div>
              <div className="field">
                <label htmlFor="rc">Et la catégorie est</label>
                <select id="rc" className="select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  <option value="">peu importe</option>
                  {MAIL_CATEGORIES.map((c) => <option key={c} value={c}>{MAIL_CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={draft.meeting} onChange={(e) => setDraft({ ...draft, meeting: e.target.checked })} /> Seulement les demandes de rendez-vous</label>
              <div className="field">
                <label htmlFor="ra">Alors</label>
                <select id="ra" className="select" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}>
                  <option value="label">classer avec une étiquette</option>
                  <option value="archive">archiver</option>
                  <option value="trash">mettre à la corbeille (récupérable)</option>
                  <option value="create_task">créer une tâche de suivi</option>
                  <option value="reply_template">répondre avec un modèle approuvé</option>
                  <option value="propose_slots">proposer des créneaux (sans réserver)</option>
                </select>
              </div>
              {draft.action === "reply_template" && (
                <div className="field">
                  <label htmlFor="rt">Modèle</label>
                  <select id="rt" className="select" value={draft.templateId} onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}>
                    <option value="">—</option>
                    {templates.data?.templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.approved ? "" : " (non approuvé)"}</option>)}
                  </select>
                </div>
              )}
              {draft.action === "label" && <div className="field"><label htmlFor="rl">Étiquette</label><input id="rl" className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div>}
            </div>
            <div className="row">
              <button className="btn primary" onClick={() => create.mutate()} disabled={!draft.name}>Voir le périmètre avant activation</button>
              <button className="btn ghost" onClick={() => setDraft(null)}>Annuler</button>
            </div>
          </div>
        </Card>
      )}
      {shown && <RuleProposal id={shown} onClose={() => setShown(null)} />}
      {q.data?.rules.filter((r) => r.status !== "rejected").length === 0 && <Card><Empty>Aucune règle. Le mode initial prépare les actions et attend votre validation.</Empty></Card>}
      {q.data?.rules.filter((r) => r.status !== "rejected").map((r) => (
        <Card key={r.id} title={r.name} actions={<span className={`badge ${r.status === "active" ? "ok" : r.status === "proposed" ? "wait" : ""}`}>{r.status === "active" ? "Active" : r.status === "proposed" ? "À confirmer" : "En pause"}</span>}>
          <div className="card-body stack-12">
            <p className="small">{r.scopeDescription}</p>
            <div className="row">
              {r.status === "proposed" && <button className="btn small primary" onClick={() => setShown(r.id)}>Examiner et confirmer</button>}
              {r.status === "active" && <button className="btn small" onClick={() => setStatus.mutate({ id: r.id, status: "paused" })}>Mettre en pause</button>}
              {r.status === "paused" && <button className="btn small" onClick={() => setStatus.mutate({ id: r.id, status: "active" })}>Réactiver</button>}
              <button className="btn ghost small danger" onClick={() => del.mutate(r.id)}>Supprimer</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consommation
// ---------------------------------------------------------------------------

interface UsageResp {
  month: string;
  byKind: { kind: string; unit: string; quantity: number; costMicros: number }[];
  budget: { monthlyLimitMicros: number; baseMonthlyLimitMicros: number; topupBalanceMicros: number; voiceMinutesDaily: number; voiceSessionMaxMinutes: number; actionsDaily: number; agentStepsPerTurn: number; alertThresholdPct: number; orgMonthlyLimitMicros: number };
  userMonthMicros: number;
  orgMonthMicros: number;
  voiceSecondsToday: number;
  exceeded: boolean;
  ratio: number;
  role: string;
}

const KIND_LABELS: Record<string, string> = { text_model: "Assistant écrit", voice: "Voix et dictée", documents: "Documents", paid_tool: "Outils", background: "Tâches de fond" };

export function UsagePage() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const q = useQuery({ queryKey: ["usage"], queryFn: () => api<UsageResp>("/api/usage") });
  const billing = useQuery({ queryKey: ["billing"], queryFn: () => api<{ enabled: boolean; subscription: { plan: string | null; status: string } | null }>("/api/billing") });
  const confirmedSession = useRef<string | null>(null);
  const topup = useMutation({
    mutationFn: (euros: 20 | 50 | 100) => api<{ url: string }>("/api/billing/topup-checkout", { body: { euros, requestId: uid() } }),
    onSuccess: (result) => { window.location.href = result.url; },
    onError: (error: Error) => toast(error.message),
  });
  useEffect(() => {
    const sessionId = params.get("recharge_session_id");
    if (!billing.data?.enabled || !sessionId || confirmedSession.current === sessionId) return;
    confirmedSession.current = sessionId;
    void api<{ confirmed: boolean }>("/api/billing/topup-confirm", { body: { sessionId } }).then((result) => {
      toast(result.confirmed ? "Recharge confirmée. Votre crédit est ajouté." : "Paiement en cours de confirmation.");
      void queryClient.invalidateQueries({ queryKey: ["usage"] });
      setParams({}, { replace: true });
    }).catch((error: Error) => toast(error.message));
  }, [billing.data?.enabled, params, setParams, toast]);
  const canTopUp = billing.data?.enabled ?? false;
  const [limit, setLimit] = useState<string>("");
  const [voiceMin, setVoiceMin] = useState<string>("");
  const save = useMutation({
    mutationFn: (scope: "user" | "org") =>
      api("/api/budgets", { method: "PUT", body: { scope, ...(limit ? { monthlyLimitMicros: Math.round(Number(limit) * 1_000_000) } : {}), ...(voiceMin ? { voiceMinutesDaily: Number(voiceMin) } : {}) } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["usage"] });
      toast("Budget mis à jour.");
    },
    onError: (e: Error) => toast(e.message),
  });
  if (q.isPending) return <div className="page"><Loading /></div>;
  if (q.error || !q.data) return (
    <div className="page stack-16">
      <PageHead title="Votre consommation" subtitle="Suivez vos crédits et les limites de votre offre." />
      <div className="warning-box stack-8" role="alert">
        <p>{q.error instanceof Error && "status" in q.error && q.error.status === 402
          ? "Aucune offre active. Choisissez-en une pour utiliser l’assistant. Vous pouvez ajouter du crédit quand vous le souhaitez."
          : "La consommation n’a pas pu être chargée."}</p>
        <Link className="m-button primary" to="/abonnement">Voir mon abonnement</Link>
        {q.error && !("status" in q.error && q.error.status === 402) && <button className="m-button secondary" onClick={() => void q.refetch()}>Réessayer</button>}
      </div>
      {q.error instanceof Error && "status" in q.error && q.error.status === 402 && <Card title="Ajouter du crédit IA"><div className="card-body stack-12"><p className="small muted">Recharge ponctuelle. Ajoutez-en quand vous en avez besoin.</p><div className="row">{([20, 50, 100] as const).map((euros) => <button key={euros} className="btn primary" disabled={!canTopUp || topup.isPending} onClick={() => topup.mutate(euros)}>Ajouter {euros} €</button>)}</div>{!canTopUp && <p className="tiny muted">Les paiements ne sont pas encore ouverts.</p>}</div></Card>}
    </div>
  );
  const u = q.data;
  const pct = Math.min(100, Math.round(u.ratio * 100));
  const textUsage = u.byKind
    .filter((item) => item.kind === "text_model" && item.unit === "tokens")
    .reduce((total, item) => ({ tokens: total.tokens + item.quantity, costMicros: total.costMicros + item.costMicros }), { tokens: 0, costMicros: 0 });
  const tokenCreditPct = u.budget.baseMonthlyLimitMicros > 0
    ? Math.min(100, Math.round((textUsage.costMicros / u.budget.baseMonthlyLimitMicros) * 100))
    : 0;
  return (
    <div className="page stack-16">
      <PageHead title="Votre consommation" subtitle={`Mois ${u.month} · coûts estimés en dollars.`} />
      <Card title="Budget du mois">
        <div className="card-body stack-12">
          <div className="spread small">
            <strong>{pct}% du budget utilisé</strong>
            <span className="muted">{formatUsdFromMicros(u.userMonthMicros)} sur {formatUsdFromMicros(u.budget.monthlyLimitMicros)}</span>
          </div>
          <div className={`progress ${pct >= 100 ? "bad" : pct >= u.budget.alertThresholdPct ? "warn" : ""}`}><div style={{ width: `${pct}%` }} /></div>
          <div className="small muted">Plafond mensuel prévu selon votre offre</div>
          <div className="stack-8">
            <div className="spread small">
              <strong>Tokens IA utilisés</strong>
              <span className="muted">{textUsage.tokens.toLocaleString("fr-FR")} tokens · {tokenCreditPct}% du plafond mensuel</span>
            </div>
            <div className={`progress ${tokenCreditPct >= 100 ? "bad" : tokenCreditPct >= u.budget.alertThresholdPct ? "warn" : ""}`}><div style={{ width: `${tokenCreditPct}%` }} /></div>
            <div className="tiny muted">Part du plafond API consommée par les tokens des demandes écrites.</div>
          </div>
          {u.budget.topupBalanceMicros > 0 && <div className="small muted">Vous avez du crédit supplémentaire disponible.</div>}
          {u.exceeded && <div className="danger-box">Budget atteint. L’IA et la voix sont en pause.</div>}
          <p className="small muted">Voix aujourd’hui : {Math.round(u.voiceSecondsToday / 60)} / {u.budget.voiceMinutesDaily} min</p>
          <Disclosure title="Voir les plafonds"><div className="stack-8 small muted"><span>{u.budget.voiceSessionMaxMinutes} min par conversation vocale</span><span>{u.budget.actionsDaily} actions par jour</span><span>{u.budget.agentStepsPerTurn} étapes par demande</span></div></Disclosure>
        </div>
      </Card>
      <Card title="Ajouter du crédit IA">
        <div className="card-body stack-12">
          <p className="small muted">Ajoutez du crédit à tout moment pour continuer à utiliser votre assistant.</p>
          <div className="row">
            {([20, 50, 100] as const).map((euros) => <button key={euros} className="btn primary" disabled={!canTopUp || topup.isPending} onClick={() => topup.mutate(euros)}>
              Ajouter {euros} €
            </button>)}
          </div>
          {!canTopUp && <p className="tiny muted">Les paiements ne sont pas encore ouverts.</p>}
        </div>
      </Card>
      <Card title="Détail des coûts" collapsible>
        <table className="table">
          <thead><tr><th>Poste</th><th>Quantité</th><th>Coût estimé</th></tr></thead>
          <tbody>
            {u.byKind.length === 0 && <tr><td colSpan={3} className="muted">Aucune consommation ce mois-ci.</td></tr>}
            {u.byKind.map((k, i) => (
              <tr key={i}><td>{KIND_LABELS[k.kind] ?? k.kind}</td><td>{k.unit === "seconds" ? `${Math.round(k.quantity / 60)} min` : `${k.quantity.toLocaleString("fr-FR")} ${k.unit}`}</td><td>{formatUsdFromMicros(k.costMicros)}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Modifier mes limites" collapsible>
        <div className="card-body stack-12">
          <div className="grid-2">
            <div className="field"><label htmlFor="lm">Budget mensuel (USD)</label><input id="lm" className="input" type="number" min={0} step={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={String(u.budget.monthlyLimitMicros / 1_000_000)} /></div>
            <div className="field"><label htmlFor="vm">Minutes de voix par jour</label><input id="vm" className="input" type="number" min={0} value={voiceMin} onChange={(e) => setVoiceMin(e.target.value)} placeholder={String(u.budget.voiceMinutesDaily)} /></div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => save.mutate("user")}>Appliquer à mon compte</button>
            {["owner", "admin"].includes(u.role) && <button className="btn" onClick={() => save.mutate("org")}>Appliquer à l'organisation</button>}
          </div>
          <p className="tiny muted">Seules les conversations vocales actives sont facturées. La veille locale est gratuite.</p>
        </div>
      </Card>
    </div>
  );
}
