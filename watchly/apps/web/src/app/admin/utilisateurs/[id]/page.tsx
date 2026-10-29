import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@watchly/ui";
import { isUuid } from "@watchly/database";
import { formatDateTime } from "@watchly/types";
import { getUserAdminView } from "@/lib/data/admin";
import { SuspensionForm } from "./suspension-form";

export const metadata: Metadata = { title: "Compte utilisateur" };

const fmt = (v: unknown) => (v instanceof Date ? formatDateTime(v) : typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? formatDateTime(v) : v === null || v === undefined ? "—" : String(v));

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await getUserAdminView(id);
  if (!d) notFound();
  const p = d.profile as Record<string, unknown>;
  const ent = d.entitlements as Record<string, unknown> | null;
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-fg">
        <Link href="/admin/utilisateurs" className="hover:text-ink">
          Utilisateurs
        </Link>{" "}
        / <span aria-current="page">{String(p.email)}</span>
      </nav>
      <PageHeader
        title={String(p.email)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{String(p.role)}</Badge>
            {p.suspended_at ? <Badge tone="danger">Suspendu depuis le {fmt(p.suspended_at)}</Badge> : <Badge tone="success">Actif</Badge>}
            <span>Inscrit le {fmt(p.created_at)}</span>
          </span>
        }
      />
      {p.suspended_at ? <p className="text-sm">Motif de suspension : {String(p.suspension_reason ?? "—")}</p> : null}
      <SuspensionForm userId={id} suspended={Boolean(p.suspended_at)} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Abonnements</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {d.subs.length ? (
              <ul className="flex flex-col gap-2">
                {d.subs.map((s, i) => (
                  <li key={i} className="border-t border-line pt-2">
                    <span className="font-medium">{String(s.plan_id)}</span> · {String(s.status)}
                    {s.cancel_at_period_end ? " · résiliation programmée" : ""} · fin de période {fmt(s.current_period_end)}
                    {s.trial_end ? ` · fin d'essai ${fmt(s.trial_end)}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-fg">Aucun abonnement (formule Découverte).</p>
            )}
            {ent ? (
              <p className="mt-3 text-muted-fg">
                Droits actuels : {String(ent.plan_id)} ({String(ent.source)}) · {String(ent.max_monitors)} surveillances · relais cloud {ent.cloud_relay ? "oui" : "non"} · sites
                Business {String(ent.business_sites)}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Utilisation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              Surveillances :{" "}
              {d.monitors.length ? d.monitors.map((m) => `${String(m.n)} ${m.kind === "page" ? "page(s)" : "sujet(s)"} ${String(m.status)}`).join(" · ") : "aucune"}
            </p>
            <p>Ordinateurs : {d.devices.length ? d.devices.map((x) => `${String(x.name)} (${String(x.platform)}, ${String(x.status)}${x.consent_local_at ? ", accord local" : ""})`).join(" · ") : "aucun"}</p>
            <p>Sites Business : {d.sites.length ? d.sites.map((s) => `${String(s.domain)} (${String(s.status)})`).join(" · ") : "aucun"}</p>
            <p>
              Coûts estimés 30 j :{" "}
              {d.costs.length ? d.costs.map((c) => `${String(c.provider)} ${(Number(c.micros) / 1e6).toFixed(2)} €`).join(" · ") : "0,00 €"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assistance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {d.tickets.length ? (
              <ul className="flex flex-col gap-1">
                {d.tickets.map((t) => (
                  <li key={String(t.id)}>
                    <Link className="text-blue hover:underline" href={`/admin/support/${String(t.id)}`}>
                      {String(t.subject)}
                    </Link>{" "}
                    · {String(t.status)} · {fmt(t.created_at)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-fg">Aucune demande.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Historique d'administration</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {d.audit.length ? (
              <ul className="flex flex-col gap-1">
                {d.audit.map((a) => (
                  <li key={String(a.id)}>
                    {fmt(a.created_at)} · {String(a.action)} par {String(a.admin_email ?? "script")} — {String(a.reason ?? "")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-fg">Aucune action enregistrée.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
