import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OFFERS, formatCreditsFromMicros, offerFor, type PlanId } from "@antonio/shared";
import { api, queryClient, uid } from "../lib/api";
import { useApp, useMe } from "../lib/app-state";
import { Card, Disclosure, Loading, PageHead } from "../components/ui";
import { Icon } from "../components/Icons";
import { usePublicStatus } from "./Landing";

interface Billing { enabled: boolean; creditBalanceMicros: number; subscription: { requestedPlan: string; plan: string | null; status: string; cancelAtPeriodEnd: boolean; hasCustomer: boolean } | null }
export function BillingPage() {
  const { toast } = useApp();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const q = useQuery({ queryKey: ["billing"], queryFn: () => api<Billing>("/api/billing") });
  const confirmation = useRef<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<"confirming" | "confirmed" | "pending" | null>(null);
  const preference = useMutation({ mutationFn: (plan: PlanId) => api("/api/billing/preference", { method: "PUT", body: { plan } }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["billing"] }); toast("Préférence enregistrée. Aucun paiement demandé."); } });
  const checkout = useMutation({ mutationFn: (plan: PlanId) => api<{ url: string }>("/api/billing/checkout", { body: { plan, requestId: uid() } }), onSuccess: (r) => { window.location.href = r.url; } });
  const upgrade = useMutation({ mutationFn: (plan: PlanId) => api<{ ok: boolean; status: string; plan: PlanId }>("/api/billing/upgrade", { body: { plan, requestId: uid() } }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["billing"] }); void queryClient.invalidateQueries({ queryKey: ["usage"] }); toast("Le changement d’offre a été envoyé à Stripe."); } });
  const portal = useMutation({ mutationFn: () => api<{ url: string }>("/api/billing/portal", { method: "POST" }), onSuccess: (r) => { window.location.href = r.url; } });
  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!q.data?.enabled || !sessionId || confirmation.current === sessionId) return;
    confirmation.current = sessionId;
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    setCheckoutStatus("confirming");
    const check = async () => {
      try {
        const result = await api<{ confirmed: boolean }>("/api/billing/confirm", { body: { sessionId } });
        if (cancelled) return;
        if (result.confirmed) {
          setCheckoutStatus("confirmed");
          void queryClient.invalidateQueries({ queryKey: ["billing"] });
          void queryClient.invalidateQueries({ queryKey: ["usage"] });
          toast("Votre abonnement est confirmé.");
          setParams({}, { replace: true });
        } else if (attempts++ < 14) timer = window.setTimeout(() => void check(), 1500);
        else setCheckoutStatus("pending");
      } catch {
        if (cancelled) return;
        if (attempts++ < 14) timer = window.setTimeout(() => void check(), 1500);
        else setCheckoutStatus("pending");
      }
    };
    void check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [q.data?.enabled, params, setParams, toast]);
  if (q.isLoading) return <div className="page"><Loading /></div>;
  if (!q.data) return <div className="page danger-box">Impossible de charger votre abonnement. Réessayez dans un instant.</div>;
  const selected = offerFor(q.data.subscription?.requestedPlan);
  const active = Boolean(q.data.subscription?.plan && ["active", "trialing"].includes(q.data.subscription.status));
  const error = checkout.error || preference.error || portal.error || upgrade.error;
  const currentOfferIndex = active ? OFFERS.findIndex((p) => p.id === q.data.subscription?.plan) : -1;
  return <div className="page billing-page stack-16">
    <PageHead title="Compte et facturation" subtitle="Votre compte, vos paiements et votre offre, réunis au même endroit." />
    {checkoutStatus && <div className={checkoutStatus === "confirmed" ? "success-box" : "warning-box"} role="status" aria-live="polite">
      {checkoutStatus === "confirming" ? "Stripe confirme votre paiement… Vous pouvez rester sur cette page, la vérification se fait automatiquement." : checkoutStatus === "confirmed" ? "Paiement confirmé. Votre abonnement est à jour." : <>La confirmation prend plus de temps que prévu. <button className="btn small" onClick={() => window.location.reload()}>Vérifier à nouveau</button></>}
    </div>}
    <Card title="Mon compte"><div className="card-body stack-12"><div><strong>{me.data?.user.displayName ?? "Votre compte"}</strong><p className="small muted">{me.data?.user.email}</p></div><div className="row wrap"><Link className="btn" to="/profil">Profil, préférences et données</Link><Link className="btn" to="/connexions">Boîtes mail et agendas</Link><Link className="btn" to="/integrations">Intégrations</Link></div></div></Card>
    <div className="grid-2">
      <Card title="Crédit IA disponible"><div className="card-body stack-8"><strong className="credit-balance-value">{formatCreditsFromMicros(q.data.creditBalanceMicros)}</strong><p className="small muted">Votre solde complémentaire s’ajoute aux crédits compris dans l’offre.</p><Link className="btn small" to="/consommation">Voir l’utilisation et ajouter du crédit →</Link></div></Card>
      <Card title="Paiements et factures"><div className="card-body stack-8"><p className="small muted">Dans l’espace sécurisé Stripe, vous pouvez gérer votre carte, consulter vos factures et vos reçus, ou annuler votre abonnement.</p>{q.data.enabled && q.data.subscription?.hasCustomer ? <button className="btn primary" disabled={portal.isPending} onClick={() => portal.mutate()}>{portal.isPending ? "Ouverture…" : "Gérer les paiements et les factures ↗"}</button> : <p className="tiny muted">La gestion des paiements sera disponible après le premier abonnement.</p>}</div></Card>
    </div>
    {q.data.subscription?.hasCustomer && <div className="billing-current"><div><h2>{active ? `Waverti ${offerFor(q.data.subscription.plan).name}` : "Votre offre"}</h2><p>{active ? (q.data.subscription.cancelAtPeriodEnd ? "Résiliation prévue à la fin de la période." : "Abonnement actif.") : `Offre souhaitée : ${selected.name}. Aucun abonnement actif.`}</p></div>{!active && <Link className="m-button primary" to="/consommation">Voir vos crédits →</Link>}</div>}
    {!q.data.enabled && <div className="warning-box small">Les paiements ne sont pas ouverts pour le moment.</div>}
    {params.get("annule") && <p className="small muted">Paiement annulé. Aucun abonnement n’a été activé.</p>}
    {error && <div className="danger-box" role="alert">{(error as Error).message}</div>}
    <div className="pricing-grid">{OFFERS.map((plan, index) => <div className={`price-card ${active ? q.data.subscription?.plan === plan.id ? "featured" : "" : selected.id === plan.id ? "featured" : ""}`} key={plan.id}><span className="plan-name">{plan.name}</span><p className="plan-description">{plan.description}</p><div className="plan-price">{plan.euros}<span>€ <small>/ mois</small></span></div><span className="plan-price-note">par utilisateur{!q.data.enabled && " · offre prévue"}</span><ul>{plan.features.map(feature => <li key={feature}><Icon.Check />{feature}</li>)}</ul>{q.data.enabled ? active ? index === currentOfferIndex ? <button className="m-button secondary" disabled>Votre offre actuelle ✓</button> : index > currentOfferIndex ? <button className="m-button primary" disabled={upgrade.isPending} onClick={() => { if (window.confirm(`Passer à ${plan.name} à ${plan.euros} €/mois maintenant ? Le changement peut entraîner une facturation immédiate au prorata.`)) upgrade.mutate(plan.id); }}>{upgrade.isPending ? "Mise à jour…" : `Passer à ${plan.name} ↗`}</button> : <button className="m-button secondary" disabled={portal.isPending} onClick={() => portal.mutate()}>Gérer dans Stripe ↗</button> : <button className="m-button primary" disabled={checkout.isPending} onClick={() => checkout.mutate(plan.id)}>{`Choisir ${plan.name} ↗`}</button> : <button className="m-button secondary" disabled={preference.isPending || selected.id === plan.id} onClick={() => preference.mutate(plan.id)}>{selected.id === plan.id ? "Votre préférence ✓" : "Enregistrer ma préférence"}</button>}</div>)}</div>
    <p className="small muted">Aucun dépassement automatique. Gérez les crédits dans <Link to="/consommation">Crédit et utilisation</Link>.</p>
  </div>;
}

interface ApiToken { id: string; name: string; createdAt: string; expiresAt: string; revokedAt: string | null }
export function IntegrationsPage() {
  const status = usePublicStatus();
  const { toast } = useApp();
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const q = useQuery({ queryKey: ["integration-tokens"], queryFn: () => api<{ tokens: ApiToken[] }>("/api/integrations/tokens") });
  const create = useMutation({ mutationFn: () => api<{ token: string }>("/api/integrations/tokens", { body: { name } }), onSuccess: (r) => { setSecret(r.token); setName(""); void queryClient.invalidateQueries({ queryKey: ["integration-tokens"] }); } });
  const revoke = useMutation({ mutationFn: (id: string) => api(`/api/integrations/tokens/${id}`, { method: "DELETE" }), onSuccess: () => { setSecret(""); void queryClient.invalidateQueries({ queryKey: ["integration-tokens"] }); toast("Accès révoqué."); } });
  const url = `${window.location.origin}/api/integrations/export`;
  return <div className="page stack-16">
    <PageHead title="Vos intégrations" subtitle="Rassemblez vos outils de travail." />
    <Card title="E-mails et agendas"><div className="card-body stack-16">
      <div className="provider-grid">{(["google", "microsoft"] as const).map(provider => <div className="provider-tile" key={provider}>
        <span className={`provider-mark ${provider}`} aria-hidden="true">{provider === "google" ? "G" : "▦"}</span>
        <div className="grow"><strong>{provider === "google" ? "Google" : "Outlook"}</strong><p className="small muted">E-mails et agenda</p></div>
        <span className={`badge ${status.data?.services[provider] ? "ok" : "wait"}`}>{status.data?.services[provider] ? "Disponible" : "Bientôt"}</span>
      </div>)}</div>
      <Link className="btn primary" style={{ alignSelf: "flex-start" }} to="/connexions">Connecter mes comptes →</Link>
    </div></Card>
    <Card title="Make, Zapier et n8n" collapsible><div className="card-body stack-16">
      <p className="small muted">Partagez les titres de vos tâches et rendez-vous. Lecture seule : aucun accès aux e-mails, aucun envoi ni modification.</p>
      <Disclosure title="Comment les connecter ?"><ol className="integration-instructions">
        <li>Créez un accès ci-dessous. Il est valable 30 jours.</li>
        <li>Dans votre outil, ajoutez une requête HTTP <b>GET</b> :<code>{url}</code></li>
        <li>Ajoutez cet en-tête :<code>Authorization: Bearer VOTRE_JETON</code></li>
        <li>Utilisez les listes <code>tasks</code> et <code>events</code> reçues. La lecture se fait à la demande.</li>
      </ol></Disclosure>
      <form className="row wrap" onSubmit={e => { e.preventDefault(); create.mutate(); }}>
        <input className="input" aria-label="Nom de la connexion API" placeholder="Nom de votre connexion" required maxLength={60} value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 300 }} />
        <button className="btn primary" disabled={create.isPending || !name.trim()} type="submit">Créer un accès en lecture seule</button>
      </form>
      {create.error && <div className="danger-box" role="alert">{(create.error as Error).message}</div>}
      {secret && <div className="integration-token-box" role="status"><strong>Votre clé d’accès · affichée une seule fois</strong><code>{secret}</code><p className="tiny muted">Gardez-la privée : elle permet de lire les titres de vos tâches et rendez-vous.</p><div className="row wrap"><button className="btn small" onClick={() => void navigator.clipboard.writeText(secret).then(() => toast("Clé copiée.")).catch(() => toast("Sélectionnez la clé pour la copier."))}>Copier</button><button className="btn ghost small" onClick={() => setSecret("")}>Masquer</button></div></div>}
      {q.isLoading ? <Loading /> : q.isError ? <p role="alert">Impossible de charger vos accès. <button className="btn small" onClick={() => void q.refetch()}>Réessayer</button></p> : <div className="stack-12">{q.data?.tokens.map(token => <div className="spread" key={token.id}><div><strong className="small">{token.name}</strong><p className="tiny muted">{token.revokedAt ? "Révoqué" : `Expire le ${new Date(token.expiresAt).toLocaleDateString("fr-FR")}`}</p></div>{!token.revokedAt && <button className="btn small ghost" disabled={revoke.isPending} onClick={() => revoke.mutate(token.id)}>Révoquer</button>}</div>)}</div>}
      {revoke.error && <div className="danger-box" role="alert">{(revoke.error as Error).message}</div>}
    </div></Card>
    <Card title="Prochainement" collapsible><div className="card-body stack-12">
      <p className="small muted">Ces connexions sont prévues. Elles ne sont pas encore disponibles.</p>
      <div className="chips">{["HubSpot", "Pipedrive", "Salesforce", "Notion", "Google Drive", "OneDrive", "SharePoint", "Todoist", "Asana", "iCloud", "Yahoo", "IMAP / CalDAV"].map(tool => <span className="badge" key={tool}>{tool}</span>)}</div>
      <Link className="btn small" style={{ alignSelf: "flex-start" }} to="/taches">Exporter mes tâches →</Link>
    </div></Card>
  </div>;
}
