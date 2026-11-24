import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { OFFERS, offerFor } from "@antonio/shared";
import { api, queryClient } from "../lib/api";
import { AssistantOrb } from "../components/AssistantOrb";
import { Icon } from "../components/Icons";
import { Brand } from "./Landing";

function AccountLayout({ children }: { children: ReactNode }) {
  return <div className="account-page"><aside className="account-story"><Brand /><div className="account-story-center"><AssistantOrb /><h2>Votre journée,<br /><span>en clair.</span></h2><p>Un espace pour vos priorités.<br />Un assistant qui apprend votre manière de travailler.</p></div><div className="account-story-footer"><Icon.Shield />Vos préférences. Vos autorisations. Votre dernier mot.</div></aside><main className="account-main">{children}</main></div>;
}
export function LoginPage() {
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => { document.title = "Connexion — Waverti"; }, []);
  const m = useMutation({
    mutationFn: () => api("/api/auth/login", { body: { email, password } }),
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "public-status" });
      await queryClient.fetchQuery({ queryKey: ["me"], queryFn: () => api("/api/auth/me") });
      const from = location.state?.from;
      nav(typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && from !== "/connexion" ? from : "/app", { replace: true });
    },
  });
  return <AccountLayout><form className="account-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}><Link to="/" className="account-back">← Retour à la présentation</Link><h1>Heureux de vous retrouver.</h1><p className="account-subtitle">Vos préférences, vos priorités, votre assistant.<br />Retrouvez votre espace Waverti.</p><div className="field"><label htmlFor="em">Adresse e-mail</label><input id="em" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><div className="field"><label htmlFor="pw">Mot de passe</label><input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>{m.error && <div role="alert" className="danger-box">{(m.error as Error).message}</div>}<button className="m-button primary" type="submit" disabled={m.isPending}>{m.isPending ? "Connexion en cours…" : "Retrouver mon assistant"}<span>→</span></button><p className="account-switch">Pas encore de compte ? <Link to="/inscription">Créer mon espace</Link></p></form></AccountLayout>;
}
export function RegisterPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState({ displayName: "", email: "", password: "", organizationName: "", withDemo: params.get("demo") === "1", requestedPlan: offerFor(params.get("offre")).id });
  useEffect(() => { document.title = "Créer mon compte — Waverti"; }, []);
  const m = useMutation({
    mutationFn: () => api("/api/auth/register", { body: f }),
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "public-status" });
      await queryClient.fetchQuery({ queryKey: ["me"], queryFn: () => api("/api/auth/me") });
      nav("/bienvenue", { replace: true });
    },
  });
  return <AccountLayout><form className="account-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}><Link to="/" className="account-back">← Retour à la présentation</Link><h1>Faites connaissance<br />avec Waverti.</h1><p className="account-subtitle">Créez votre compte, puis personnalisez votre assistant.<br />Vous choisissez les connexions et les autorisations.</p><div className="account-free-note"><Icon.Check width={13} height={13} />Création gratuite · sans carte · aucun abonnement automatique</div><div className="field"><label htmlFor="dn">Votre nom</label><input id="dn" className="input" autoComplete="name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required /></div><div className="field"><label htmlFor="em">Adresse e-mail</label><input id="em" className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div><div className="field"><label htmlFor="pw">Mot de passe · 10 caractères minimum</label><input id="pw" className="input" type="password" autoComplete="new-password" minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div><div className="field"><label htmlFor="org">Entreprise · facultatif</label><input id="org" className="input" autoComplete="organization" value={f.organizationName} onChange={(e) => setF({ ...f, organizationName: e.target.value })} /></div><div className="field"><label htmlFor="plan">L’offre qui vous intéresse</label><select id="plan" className="select" value={f.requestedPlan} onChange={(e) => setF({ ...f, requestedPlan: offerFor(e.target.value).id })}>{OFFERS.map(p => <option key={p.id} value={p.id}>{p.name} · {p.euros} €/mois prévus au lancement</option>)}</select></div><label className="check"><input type="checkbox" checked={f.withDemo} onChange={(e) => setF({ ...f, withDemo: e.target.checked })} />Ajouter des données fictives pour explorer la démonstration.</label>{m.error && <div role="alert" className="danger-box">{(m.error as Error).message}</div>}<button className="m-button primary" type="submit" disabled={m.isPending}>{m.isPending ? "Création de votre espace…" : "Créer mon espace gratuitement"}<span>→</span></button><p className="account-switch">Déjà un compte ? <Link to="/connexion">Se connecter</Link></p><p className="account-data-note">Votre compte enregistre vos préférences. Vous pouvez exporter vos données ou supprimer votre compte dans les réglages. <Link to="/#confidentialite">En savoir plus sur vos données.</Link></p></form></AccountLayout>;
}