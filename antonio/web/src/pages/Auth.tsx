import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, queryClient } from "../lib/api";

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => api("/api/auth/login", { body: { email, password } }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["me"] });
      nav("/");
    },
  });
  return (
    <div className="auth-wrap">
      <form className="card card-pad auth-card stack-16" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="row">
          <span className="orb" style={{ width: 34, height: 34 }} aria-hidden />
          <h1>Connexion</h1>
        </div>
        <div className="field"><label htmlFor="em">Adresse e-mail</label><input id="em" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label htmlFor="pw">Mot de passe</label><input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {m.error && <div className="danger-box">{(m.error as Error).message}</div>}
        <button className="btn primary" type="submit" disabled={m.isPending}>Se connecter</button>
        <p className="small muted">Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></p>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const nav = useNavigate();
  const [f, setF] = useState({ displayName: "", email: "", password: "", organizationName: "", withDemo: true });
  const m = useMutation({
    mutationFn: () => api("/api/auth/register", { body: f }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["me"] });
      nav("/bienvenue");
    },
  });
  return (
    <div className="auth-wrap">
      <form className="card card-pad auth-card stack-16" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="row">
          <span className="orb" style={{ width: 34, height: 34 }} aria-hidden />
          <h1>Créer un compte</h1>
        </div>
        <div className="field"><label htmlFor="dn">Votre nom</label><input id="dn" className="input" autoComplete="name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required /></div>
        <div className="field"><label htmlFor="em">Adresse e-mail</label><input id="em" className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div className="field"><label htmlFor="pw">Mot de passe (10 caractères minimum)</label><input id="pw" className="input" type="password" autoComplete="new-password" minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
        <div className="field"><label htmlFor="org">Entreprise (facultatif)</label><input id="org" className="input" value={f.organizationName} onChange={(e) => setF({ ...f, organizationName: e.target.value })} /></div>
        <label className="check small">
          <input type="checkbox" checked={f.withDemo} onChange={(e) => setF({ ...f, withDemo: e.target.checked })} />
          Ajouter un compte de démonstration (données fictives, envois simulés)
        </label>
        {m.error && <div className="danger-box">{(m.error as Error).message}</div>}
        <button className="btn primary" type="submit" disabled={m.isPending}>Créer mon compte</button>
        <p className="small muted">Déjà inscrit ? <Link to="/connexion">Se connecter</Link></p>
      </form>
    </div>
  );
}
