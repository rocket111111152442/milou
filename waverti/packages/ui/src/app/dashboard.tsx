import type * as React from "react";
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  PackageSearch,
  Plus,
  ShieldAlert,
  TriangleAlert,
  Info,
  Settings,
  Rocket,
  Circle,
} from "lucide-react";
import { formatDateTime, formatRelative, type OverviewData } from "@waverti/types";
import { cn } from "../lib/cn";
import { Badge } from "../components/badge";
import { HeroBanner, IconTile, Section, StatTile, type TileTone } from "../components/blocks";
import { Progress } from "../components/feedback";
import { DeviceStatusList } from "./overview";
import { defaultRenderLink, type RenderLink } from "./link";

type AttentionTone = "danger" | "warning" | "info";
export interface AttentionItem {
  key: string;
  tone: AttentionTone;
  title: string;
  detail?: string;
  href?: string;
  cta?: string;
}

/** Ce qui demande une action ou une lecture : paiement, alertes non lues, vérifications en échec, limites proches. */
export function attentionItems(
  data: OverviewData,
  hrefs: { alerts: string; subscription: string; monitor: (id: string) => string },
  cloudRelay: boolean,
  now: Date = new Date(),
): AttentionItem[] {
  const out: AttentionItem[] = [];
  const sub = data.subscription;
  if (sub.status === "past_due") {
    out.push({ key: "pay", tone: "danger", title: "Votre dernier paiement n'a pas abouti", detail: "Mettez à jour votre carte pour que vos surveillances continuent.", href: hrefs.subscription, cta: "Régler le problème" });
  } else if (!sub.planId && !sub.betaEndsAt) {
    out.push({ key: "nosub", tone: "info", title: "Vos surveillances sont en pause", detail: "Aucune formule n'est active pour le moment.", href: hrefs.subscription, cta: "Choisir une formule" });
  } else if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
    out.push({ key: "cancel", tone: "warning", title: `Votre abonnement s'arrête le ${formatDateTime(sub.currentPeriodEnd)}`, detail: "Vous pouvez le reprendre à tout moment avant cette date.", href: hrefs.subscription, cta: "Gérer mon abonnement" });
  }
  const urgent = data.recentAlerts.filter((n) => !n.readAt && (n.priority === "high" || n.priority === "critical"));
  for (const n of urgent.slice(0, 2)) {
    out.push({ key: `alert-${n.id}`, tone: n.priority === "critical" ? "danger" : "warning", title: n.title, detail: n.taskName ? `Surveillance : ${n.taskName}` : undefined, href: n.linkPath ?? hrefs.alerts, cta: "Voir l'alerte" });
  }
  const unread = data.recentAlerts.filter((n) => !n.readAt).length - urgent.length;
  if (unread > 0) {
    out.push({ key: "unread", tone: "info", title: unread === 1 ? "1 alerte n'a pas encore été lue" : `${unread} alertes n'ont pas encore été lues`, href: hrefs.alerts, cta: "Lire mes alertes" });
  }
  const seen = new Set<string>();
  for (const r of data.latestResults) {
    if (r.outcome !== "error" || seen.has(r.monitorId)) continue;
    seen.add(r.monitorId);
    out.push({ key: `err-${r.monitorId}`, tone: "warning", title: `« ${r.monitorName} » n'a pas pu être vérifiée`, detail: "Waverti réessaiera automatiquement. Vous pouvez aussi vérifier l'adresse de la page.", href: hrefs.monitor(r.monitorId), cta: "Ouvrir la surveillance" });
    if (seen.size >= 2) break;
  }
  for (const q of data.quotas) {
    if (q.limit > 0 && q.used / q.limit >= 0.9) {
      out.push({ key: `quota-${q.key}`, tone: "warning", title: q.used >= q.limit ? `Limite atteinte : ${q.label.toLowerCase()}` : `Vous approchez de la limite : ${q.label.toLowerCase()}`, detail: `${q.used} utilisé(s) sur ${q.limit}.`, href: hrefs.subscription, cta: "Voir les formules" });
    }
  }
  if (data.devices.length > 0 && !cloudRelay && data.devices.every((d) => !d.online)) {
    out.push({ key: "offline", tone: "info", title: "Votre ordinateur est hors ligne", detail: `Dernière connexion : ${formatRelative(data.devices[0]?.lastSeenAt ?? null, now)}. Les contrôles locaux reprendront à sa reconnexion.` });
  }
  return out;
}

interface ActivityEntry {
  key: string;
  at: string;
  tone: TileTone;
  icon: React.ReactNode;
  text: string;
  detail?: string;
  href?: string;
}

/** Fil d'activité en phrases simples : alertes d'abord, puis vérifications (les « rien de nouveau » sont limitées). */
export function activityEntries(data: OverviewData, monitorHref: (id: string) => string, alertsHref: string, max = 7): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const n of data.recentAlerts.slice(0, 4)) {
    entries.push({ key: `n-${n.id}`, at: n.createdAt, tone: n.priority === "critical" ? "red" : "violet", icon: <Bell />, text: n.title, detail: n.taskName ? `Surveillance : ${n.taskName}` : undefined, href: n.linkPath ?? alertsHref });
  }
  let quiet = 0;
  for (const r of data.latestResults) {
    if (r.outcome === "triggered" || r.outcome === "changed") {
      if (data.recentAlerts.some((n) => n.taskName === r.monitorName && Math.abs(new Date(n.createdAt).getTime() - new Date(r.checkedAt).getTime()) < 120_000)) continue;
      entries.push({ key: `r-${r.id}`, at: r.checkedAt, tone: "blue", icon: <Eye />, text: `Changement détecté sur « ${r.monitorName} »`, detail: r.summary, href: monitorHref(r.monitorId) });
    } else if (r.outcome === "error") {
      entries.push({ key: `r-${r.id}`, at: r.checkedAt, tone: "amber", icon: <TriangleAlert />, text: `« ${r.monitorName} » n'a pas pu être vérifiée`, href: monitorHref(r.monitorId) });
    } else if (quiet < 3) {
      quiet++;
      entries.push({ key: `r-${r.id}`, at: r.checkedAt, tone: "green", icon: <CheckCircle2 />, text: `« ${r.monitorName} » vérifiée : rien de nouveau`, href: monitorHref(r.monitorId) });
    }
  }
  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, max);
}

const quickSurface: Record<TileTone, string> = {
  blue: "border-blue/15 bg-[linear-gradient(135deg,#dfe8ff,#eef2ff)]",
  violet: "border-violet/15 bg-[linear-gradient(135deg,#ece0ff,#f6efff)]",
  green: "border-success/15 bg-[linear-gradient(135deg,#d9f3e8,#ecf9f2)]",
  amber: "border-warning/20 bg-[linear-gradient(135deg,#ffe9c2,#fff4de)]",
  red: "border-danger/15 bg-[linear-gradient(135deg,#ffdce2,#ffeef1)]",
};

const attentionStyle: Record<AttentionTone, { box: string; icon: React.ReactNode; tone: TileTone }> = {
  danger: { box: "border-danger/25 bg-danger-soft", icon: <ShieldAlert />, tone: "red" },
  warning: { box: "border-warning/25 bg-warning-soft", icon: <TriangleAlert />, tone: "amber" },
  info: { box: "border-blue/20 bg-tint-blue", icon: <Info />, tone: "blue" },
};

export function DashboardView({
  data,
  userName,
  renderLink = defaultRenderLink,
  newMonitorHref = "/app/surveillances/nouvelle",
  productSearchHref,
  settingsHref = "/app/parametres",
  alertsHref = "/app/alertes",
  subscriptionHref = "/app/abonnement",
  monitorHref = (id: string) => `/app/surveillances/${id}`,
  now,
  cloudRelay,
}: {
  data: OverviewData;
  userName?: string | null;
  renderLink?: RenderLink;
  newMonitorHref?: string;
  /** Lien de la recherche de produit : à ne fournir que lorsque la fonction est réellement utilisable. */
  productSearchHref?: string;
  settingsHref?: string;
  alertsHref?: string;
  subscriptionHref?: string;
  monitorHref?: (id: string) => string;
  now?: Date;
  cloudRelay: boolean;
}) {
  const link = (href: string, children: React.ReactNode, className: string) => renderLink({ href, className, children });
  const sub = data.subscription;
  const attention = attentionItems(data, { alerts: alertsHref, subscription: subscriptionHref, monitor: monitorHref }, cloudRelay, now);
  const activity = activityEntries(data, monitorHref, alertsHref);
  const next = data.upcoming[0];

  const heroBtn = "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors [&_svg]:size-4";
  const planLabel = sub.planName ? `Formule ${sub.planName}` : sub.betaEndsAt ? "Accès bêta" : "Aucune formule";
  const planHint = sub.isTrial && sub.trialEndsAt ? `Essai gratuit jusqu'au ${formatDateTime(sub.trialEndsAt)}` : sub.betaEndsAt ? `Jusqu'au ${formatDateTime(sub.betaEndsAt)}` : null;

  const subtitle =
    data.activeMonitors === 0
      ? "Commencez par créer votre première surveillance : un prix, un stock ou une page à suivre."
      : attention.length === 0
        ? `Tout est en ordre. Waverti surveille ${data.activeMonitors === 1 ? "1 élément" : `${data.activeMonitors} éléments`} pour vous.`
        : attention.length === 1
          ? "Une chose mérite votre attention."
          : `${attention.length} choses méritent votre attention.`;

  return (
    <div className="flex flex-col gap-6">
      <HeroBanner
        eyebrow={planHint ? `${planLabel} · ${planHint}` : planLabel}
        title={userName ? `Bonjour ${userName}` : "Bonjour"}
        description={subtitle}
        actions={
          <>
            {link(newMonitorHref, <><Plus aria-hidden="true" /> Nouvelle surveillance</>, cn(heroBtn, "bg-white text-ink shadow-soft hover:bg-white/90"))}
            {productSearchHref
              ? link(productSearchHref, <><PackageSearch aria-hidden="true" /> Rechercher un produit</>, cn(heroBtn, "bg-white/15 text-white ring-1 ring-inset ring-white/35 hover:bg-white/25"))
              : link(alertsHref, <><Bell aria-hidden="true" /> Mes alertes</>, cn(heroBtn, "bg-white/15 text-white ring-1 ring-inset ring-white/35 hover:bg-white/25"))}
          </>
        }
      />

      {data.activeMonitors === 0 || data.latestResults.length === 0 ? (
        <Section id="premiers-pas" title="Pour bien démarrer" description="Trois gestes simples, dans l'ordre." icon={<Rocket />} tone="violet">
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              { done: data.activeMonitors > 0, title: "Créez votre première surveillance", text: "Choisissez ce que vous voulez suivre : un prix, un stock, une page.", href: newMonitorHref, cta: "Commencer" },
              { done: data.latestResults.length > 0, title: "Laissez Waverti vérifier", text: "Le premier contrôle apparaît ici dès qu'il a eu lieu. Vous n'avez rien à faire.", href: undefined, cta: undefined },
              { done: false, title: "Choisissez comment être prévenu", text: "E-mail, notification : réglez-le une fois pour toutes.", href: settingsHref, cta: "Régler" },
            ].map((st, i) => (
              <li key={st.title} className={cn("flex flex-col gap-2 rounded-2xl border p-4", st.done ? "border-success/20 bg-tint-green" : "border-violet/15 bg-white/70")}>
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {st.done ? <CheckCircle2 className="size-5 text-success" aria-hidden="true" /> : <Circle className="size-5 text-violet" aria-hidden="true" />}
                  <span className="sr-only">{st.done ? "Fait : " : `Étape ${i + 1} : `}</span>
                  {st.title}
                </span>
                <span className="text-sm text-ink-soft">{st.text}</span>
                {st.href && st.cta && !st.done ? link(st.href, <>{st.cta} <ChevronRight className="size-4" aria-hidden="true" /></>, "mt-auto inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline") : null}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Surveillances actives" value={data.activeMonitors} icon={<Activity />} tone="blue" hint={data.activeMonitors === 0 ? "Aucune pour l'instant" : undefined} />
        <StatTile label="Alertes cette semaine" value={data.alertsLast7Days} icon={<Bell />} tone="violet" hint={data.alertsLast7Days === 0 ? "Rien à signaler" : undefined} />
        <StatTile
          label="Prochaine vérification"
          value={<span className="text-xl">{next?.nextRunAt ? formatRelative(next.nextRunAt, now) : "—"}</span>}
          hint={next?.name}
          icon={<Clock />}
          tone="green"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          <Section id="attention" title="Nécessite votre attention" description={attention.length ? undefined : "Rien d'urgent pour le moment."} icon={<ShieldAlert />} tone={attention.some((a) => a.tone === "danger") ? "red" : attention.length ? "amber" : "green"}>
            {attention.length === 0 ? (
              <p className="flex items-center gap-3 rounded-xl bg-success-soft px-4 py-3.5 text-sm text-ink-soft">
                <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
                Tout est en ordre : aucune alerte à lire, aucun problème détecté.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {attention.map((a) => (
                  <li key={a.key} className={cn("flex items-start gap-3 rounded-xl border p-4", attentionStyle[a.tone].box)}>
                    <IconTile icon={attentionStyle[a.tone].icon} tone={attentionStyle[a.tone].tone} solid className="size-9 rounded-xl [&_svg]:size-4" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{a.title}</p>
                      {a.detail ? <p className="mt-0.5 text-sm text-ink-soft">{a.detail}</p> : null}
                    </div>
                    {a.href && a.cta ? link(a.href, <>{a.cta} <ChevronRight className="size-4" aria-hidden="true" /></>, "inline-flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-blue hover:underline") : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="activite" title="Activité récente" description="Ce que Waverti a fait pour vous." icon={<Activity />} tone="violet" action={link(alertsHref, "Toutes les alertes", "font-medium text-blue hover:underline")}>
            {activity.length === 0 ? (
              <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted-fg">
                Rien pour l'instant. Dès le premier contrôle, vous verrez ici ce qui a été vérifié ou détecté.
              </p>
            ) : (
              <ol className="flex flex-col">
                {activity.map((e, i) => (
                  <li key={e.key} className={cn("flex items-start gap-3 py-3", i > 0 && "border-t border-line/70")}>
                    <IconTile icon={e.icon} tone={e.tone} solid className="size-9 rounded-xl [&_svg]:size-4" />
                    <div className="min-w-0 flex-1">
                      {e.href ? link(e.href, e.text, "font-medium text-ink hover:text-blue") : <p className="font-medium">{e.text}</p>}
                      {e.detail ? <p className="line-clamp-2 text-sm text-muted-fg">{e.detail}</p> : null}
                    </div>
                    <time dateTime={e.at} className="shrink-0 pt-0.5 text-xs text-muted-fg">
                      {formatRelative(e.at, now)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section id="actions" title="Actions rapides" icon={<Plus />} tone="blue">
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: newMonitorHref, label: "Surveiller une page", icon: <Eye />, tone: "blue" as TileTone },
                ...(productSearchHref ? [{ href: productSearchHref, label: "Rechercher un produit", icon: <PackageSearch />, tone: "violet" as TileTone }] : [{ href: settingsHref, label: "Régler mes notifications", icon: <Settings />, tone: "violet" as TileTone }]),
                { href: alertsHref, label: "Lire mes alertes", icon: <Bell />, tone: "amber" as TileTone },
                { href: subscriptionHref, label: "Mon abonnement", icon: <CreditCard />, tone: "green" as TileTone },
              ].map((a) => (
                <div key={a.href}>
                  {link(
                    a.href,
                    <>
                      <IconTile icon={a.icon} tone={a.tone} solid />
                      <span className="text-sm font-medium leading-snug text-ink">{a.label}</span>
                    </>,
                    cn("flex h-full flex-col items-start gap-3 rounded-2xl border p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0", quickSurface[a.tone]),
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section id="formule" title="Votre formule" icon={<CreditCard />} tone="green" action={link(subscriptionHref, "Gérer", "font-medium text-blue hover:underline")}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={sub.status === "past_due" ? "danger" : sub.planId || sub.betaEndsAt ? "success" : "neutral"}>{planLabel}</Badge>
              {sub.isTrial ? <Badge tone="info">Essai gratuit</Badge> : null}
            </div>
            <div className="flex flex-col gap-4">
              {data.quotas.map((q) => (
                <Progress key={q.key} label={q.label} value={q.used} max={q.limit} />
              ))}
            </div>
            {data.upcoming.length ? (
              <div className="mt-5 border-t border-line/70 pt-4">
                <h3 className="mb-2 text-sm font-semibold">Prochains contrôles</h3>
                <ul className="flex flex-col gap-2">
                  {data.upcoming.slice(0, 4).map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 text-sm">
                      {link(monitorHref(u.id), u.name, "truncate font-medium text-ink hover:text-blue")}
                      <span className="shrink-0 text-xs text-muted-fg">{formatRelative(u.nextRunAt, now)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <details className="mt-5 border-t border-line/70 pt-3 text-sm">
              <summary className="cursor-pointer font-medium text-muted-fg hover:text-ink">Où sont effectués vos contrôles ?</summary>
              <div className="mt-3">
                <DeviceStatusList devices={data.devices} cloudRelay={cloudRelay} now={now} />
              </div>
            </details>
          </Section>
        </div>
      </div>
    </div>
  );
}
