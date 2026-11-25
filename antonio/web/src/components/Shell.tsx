import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatUsdFromMicros, type ConnectionDTO, type ViewId } from "@antonio/shared";
import { api, queryClient } from "../lib/api";
import { useApp, useMe, useRealtime } from "../lib/app-state";
import { Icon } from "./Icons";

export const VIEW_PATHS: Record<ViewId, string> = { workspace: "/app", briefing: "/point", inbox: "/messages", agenda: "/agenda", tasks: "/taches", approvals: "/validations", history: "/historique", templates: "/modeles", rules: "/regles", connections: "/connexions", settings: "/profil", usage: "/consommation" };

export function Shell({ children }: { children: ReactNode }) {
  const me = useMe();
  const { setNavigator, toasts } = useApp();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useRealtime(Boolean(me.data));
  useEffect(() => setNavigator((v) => navigate(VIEW_PATHS[v])), [navigate, setNavigator]);
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  const conns = useQuery({ queryKey: ["connections"], queryFn: () => api<{ connections: ConnectionDTO[] }>("/api/connections"), enabled: Boolean(me.data) });
  const billing = useQuery({ queryKey: ["billing"], queryFn: () => api<{ creditBalanceMicros: number }>("/api/billing"), enabled: Boolean(me.data), refetchInterval: 60_000 });
  const pending = useQuery({ queryKey: ["actions", "pending-count"], queryFn: () => api<{ actions: unknown[] }>("/api/actions?status=awaiting_approval"), enabled: Boolean(me.data), refetchInterval: 60_000 });
  const logout = useMutation({ mutationFn: () => api("/api/auth/logout", { method: "POST" }), onSuccess: () => { queryClient.clear(); navigate("/connexion"); } });
  const hasDemo = conns.data?.connections.some((c) => c.isDemo);
  const broken = conns.data?.connections.filter((c) => c.status === "expired" || c.status === "error") ?? [];
  const nPending = pending.data?.actions.length ?? 0;
  const name = me.data?.assistantName ?? "Waverti";
  useEffect(() => { document.title = `${name} — Mon espace`; }, [name, loc.pathname]);
  const link = (to: string, label: string, icon?: ReactNode) => <NavLink to={to} aria-label={label} end={to === "/app"} className={({ isActive }) => `studio-nav-link ${isActive ? "active" : ""}`}>{icon}<span>{label}</span></NavLink>;
  return (
    <div className={`shell studio-shell ${loc.pathname === "/app" ? "is-workspace" : ""}`}>
      <header className="studio-header">
        <NavLink className="studio-brand" to="/app" aria-label={`${name}, accueil`}><span className="brand-star">✳</span><span>{name}<span className="brand-period">.</span></span></NavLink>
        <nav className="studio-navigation" aria-label="Navigation principale">
          {link("/app", "Assistant", <Icon.Spark />)}{link("/messages", "Messages", <Icon.Inbox />)}{link("/agenda", "Agenda", <Icon.Calendar />)}{link("/validations", "À valider", <Icon.Shield />)}
          {nPending > 0 && <span className="nav-pending">{nPending}</span>}
        </nav>
        <div className="studio-header-right"><span className="studio-date">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date())}</span><NavLink to="/consommation" className="studio-credit-pill" aria-label={`Crédit IA disponible : ${billing.data ? formatUsdFromMicros(billing.data.creditBalanceMicros) : "chargement"}`} title="Votre crédit IA disponible"><Icon.Gauge /><span>{billing.data ? formatUsdFromMicros(billing.data.creditBalanceMicros) : "Crédit IA"}</span></NavLink><button className="studio-menu-button" aria-label="Ouvrir les réglages et les autres espaces" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Icon.Menu /></button><NavLink to="/abonnement" className="studio-avatar" aria-label="Compte et facturation">{me.data?.user.displayName.charAt(0).toUpperCase() ?? "A"}</NavLink></div>
      </header>
      {open && <><button className="studio-menu-backdrop" aria-label="Fermer le menu" onClick={() => setOpen(false)} /><nav className="studio-menu" aria-label="Autres espaces et réglages"><div className="studio-menu-label">Votre espace</div>{link("/point", "Point du jour", <Icon.Sun />)}{link("/taches", "Tâches", <Icon.Tasks />)}{link("/historique", "Historique", <Icon.History />)}<div className="studio-menu-label">Personnaliser</div>{link("/regles", "Règles", <Icon.Rule />)}{link("/modeles", "Modèles", <Icon.Template />)}{link("/connexions", "Connexions", <Icon.Plug />)}{link("/profil", "Profil, préférences et données", <Icon.User />)}<div className="studio-menu-label">Compte et gestion</div>{link("/abonnement", "Compte et facturation", <Icon.Gauge />)}{link("/consommation", "Crédit et utilisation", <Icon.Gauge />)}<NavLink className="studio-nav-link" to="/integrations"><Icon.Plug /><span>Intégrations & API</span></NavLink><NavLink className="studio-nav-link" to="/"><Icon.Spark /><span>Présentation de Waverti</span></NavLink><div className="studio-menu-footer"><span className="tiny muted">{me.data?.user.email}</span><button className="btn ghost small" onClick={() => logout.mutate()}>Se déconnecter</button></div></nav></>}
      <main className="studio-main"><div className="studio-status-strip"><span className="workspace-label"><span />ESPACE PERSONNEL</span>{hasDemo && <span className="studio-demo-label" role="note">Démonstration · données fictives · aucun envoi réel</span>}{me.data?.engine === "demo" && <span className="studio-engine-label">IA et voix non connectées</span>}</div>{broken.length > 0 && <div className="connection-notice" role="alert">{broken.length} connexion(s) à rétablir · <NavLink to="/connexions">Vérifier les comptes</NavLink></div>}<div className="studio-page-content">{children}</div></main>
      <div className="toast-zone" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>
    </div>
  );
}
