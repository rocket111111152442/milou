import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ConnectionDTO, ViewId } from "@antonio/shared";
import { api, queryClient } from "../lib/api";
import { useApp, useMe, useRealtime } from "../lib/app-state";
import { Icon } from "./Icons";

export const VIEW_PATHS: Record<ViewId, string> = {
  workspace: "/",
  briefing: "/point",
  inbox: "/messages",
  agenda: "/agenda",
  tasks: "/taches",
  approvals: "/validations",
  history: "/historique",
  templates: "/modeles",
  rules: "/regles",
  connections: "/connexions",
  settings: "/profil",
  usage: "/consommation",
};

export function Shell({ children }: { children: ReactNode }) {
  const me = useMe();
  const { setNavigator, toasts } = useApp();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useRealtime(Boolean(me.data));
  useEffect(() => setNavigator((v) => navigate(VIEW_PATHS[v])), [navigate, setNavigator]);
  useEffect(() => setOpen(false), [loc.pathname]);
  const conns = useQuery({ queryKey: ["connections"], queryFn: () => api<{ connections: ConnectionDTO[] }>("/api/connections"), enabled: Boolean(me.data) });
  const pending = useQuery({
    queryKey: ["actions", "pending-count"],
    queryFn: () => api<{ actions: unknown[] }>("/api/actions?status=awaiting_approval"),
    enabled: Boolean(me.data),
    refetchInterval: 60_000,
  });
  const logout = useMutation({
    mutationFn: () => api("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      navigate("/connexion");
    },
  });
  const hasDemo = conns.data?.connections.some((c) => c.isDemo);
  const broken = conns.data?.connections.filter((c) => c.status === "expired" || c.status === "error") ?? [];
  const nPending = pending.data?.actions.length ?? 0;
  const name = me.data?.assistantName ?? "Antonio";

  const link = (to: string, label: string, icon: ReactNode, extra?: ReactNode) => (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
      {icon}
      <span>{label}</span>
      {extra}
    </NavLink>
  );

  return (
    <div className="shell">
      <nav className={`sidebar ${open ? "open" : ""}`} aria-label="Navigation principale">
        <div className="brand">
          <span className="orb-mini" aria-hidden />
          <span>{name}</span>
        </div>
        {link("/", "Assistant", <Icon.Spark />)}
        {link("/point", "Point du jour", <Icon.Sun />)}
        {link("/messages", "Boîte de réception", <Icon.Inbox />)}
        {link("/agenda", "Agenda", <Icon.Calendar />)}
        {link("/taches", "Tâches", <Icon.Tasks />)}
        {link("/validations", "Validations", <Icon.Shield />, nPending ? <span className="count">{nPending}</span> : null)}
        {link("/historique", "Historique", <Icon.History />)}
        <div className="nav-section">Réglages</div>
        {link("/regles", "Règles", <Icon.Rule />)}
        {link("/modeles", "Modèles", <Icon.Template />)}
        {link("/connexions", "Connexions", <Icon.Plug />, broken.length ? <span className="count" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>!</span> : null)}
        {link("/profil", "Profil et préférences", <Icon.User />)}
        {link("/consommation", "Consommation", <Icon.Gauge />)}
        <div style={{ marginTop: "auto", paddingTop: 16 }} className="stack-8">
          <div className="tiny muted" style={{ padding: "0 10px" }}>
            {me.data?.user.email}
          </div>
          <button className="btn ghost small" onClick={() => logout.mutate()}>
            Se déconnecter
          </button>
        </div>
      </nav>
      <div className="main">
        {hasDemo && (
          <div className="demo-banner" role="note">
            <strong>Mode démonstration</strong> — un compte fictif est connecté : ses messages, rendez-vous et envois sont simulés, aucun e-mail réel n'est envoyé.
          </div>
        )}
        {broken.length > 0 && (
          <div className="demo-banner" style={{ background: "var(--bad-soft)", color: "var(--bad)", borderColor: "#f1cfca" }} role="alert">
            Connexion à rétablir : {broken.map((b) => b.accountEmail).join(", ")} — <NavLink to="/connexions">Ouvrir Connexions</NavLink>
          </div>
        )}
        <div className="topbar">
          <button className="btn ghost icon mobile-nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <Icon.Menu />
          </button>
          <div className="grow" />
          {nPending > 0 && (
            <NavLink to="/validations" className="badge wait" style={{ textDecoration: "none" }}>
              {nPending} en attente de validation
            </NavLink>
          )}
          {me.data?.engine === "demo" && (
            <span className="badge" title="OPENAI_API_KEY absente : compréhension limitée à des commandes simples">
              Sans IA
            </span>
          )}
        </div>
        <div className="content">{children}</div>
      </div>
      <div className="toast-zone" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
