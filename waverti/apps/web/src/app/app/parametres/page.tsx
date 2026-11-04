import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, CheckCircle2, CircleAlert, CreditCard, Laptop, Lock, Palette, ShieldCheck, UserRound } from "lucide-react";
import { Badge, Callout, Section } from "@waverti/ui";
import { PAID_PLAN_IDS, PLAN_CATALOG } from "@waverti/billing/catalog";
import { formatCents, formatDateTime, formatRelative } from "@waverti/types";
import { desc, eq, profiles, userSessions, users, withUser } from "@waverti/database";
import { remainingRecoveryCodes } from "@waverti/auth";
import { requireUser } from "@/lib/auth";
import { getSubscriptionView, listDevices } from "@/lib/data/account";
import { isBillingConfigured } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { InstallApp } from "@/components/pwa/install-app";
import { AppearanceSettings } from "@/components/app/appearance";
import { CloseOtherSessions } from "@/components/app/session-actions";
import { SettingsNav } from "@/components/app/settings-nav";
import { describeUserAgent } from "@/lib/ua";
import { PlanActions } from "../abonnement/plan-actions";
import { DangerZone, DevicesList, MfaSettings, NotificationPrefs, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ "double-authentification"?: string; "code-recuperation"?: string }> }) {
  const user = await requireUser("/app/parametres");
  const sp = await searchParams;
  const mfaRequired = sp["double-authentification"] === "requise" && !user.mfa.enrolled;
  const recoveryUsed = sp["code-recuperation"] === "utilise";
  const remaining = user.mfa.enrolled ? await remainingRecoveryCodes(getDb(), user.id) : 0;
  const [prefs] = await withUser(getDb(), user.id, (tx) =>
    tx
      .select({ notifyEmail: profiles.notifyEmail, notifyInapp: profiles.notifyInapp, notifyDesktop: profiles.notifyDesktop, marketingOptIn: profiles.marketingOptIn })
      .from(profiles)
      .where(eq(profiles.id, user.id)),
  );
  const devices = await listDevices(user.id);
  const sub = await getSubscriptionView(user.id);
  const billing = isBillingConfigured();
  const [account] = await getDb().select({ createdAt: users.createdAt, passwordChangedAt: users.passwordChangedAt }).from(users).where(eq(users.id, user.id)).limit(1);
  const sessions = await getDb()
    .select({ id: userSessions.id, lastSeenAt: userSessions.lastSeenAt, createdAt: userSessions.createdAt, userAgent: userSessions.userAgent })
    .from(userSessions)
    .where(eq(userSessions.userId, user.id))
    .orderBy(desc(userSessions.lastSeenAt))
    .limit(20);
  const hasPlan = Boolean(sub.subscriptionId);
  const checks = [
    { ok: true, label: "Adresse e-mail confirmée" },
    { ok: true, label: "Mot de passe défini", detail: account?.passwordChangedAt ? `modifié le ${formatDateTime(account.passwordChangedAt.toISOString())}` : null },
    { ok: user.mfa.enrolled, label: "Double authentification", detail: user.mfa.enrolled ? null : "recommandée" },
  ];
  const done = checks.filter((c) => c.ok).length;
  const nav = [
    { id: "compte", label: "Compte" },
    ...(hasPlan ? [{ id: "formule", label: "Formule" }] : []),
    { id: "notifications", label: "Notifications" },
    { id: "apparence", label: "Apparence" },
    { id: "securite", label: "Sécurité" },
    { id: "appareils", label: "Appareils" },
    { id: "confidentialite", label: "Confidentialité" },
  ];
  const initial = (user.displayName ?? user.email).slice(0, 1).toUpperCase();
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="settings-title" className="grain relative overflow-hidden rounded-[28px] bg-[#0d0c2b] p-6 text-white shadow-lift sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-[360px] rounded-full bg-violet/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-10 size-[300px] rounded-full bg-blue/40 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1d3fd6,#8028ff)] font-display text-2xl font-bold shadow-soft" aria-hidden="true">
              {initial}
            </span>
            <div className="min-w-0">
              <h1 id="settings-title" className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Paramètres
              </h1>
              <p className="truncate text-white/85">{user.displayName ? `${user.displayName} · ` : ""}{user.email}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
                {account ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" aria-hidden="true" /> Membre depuis le {formatDateTime(account.createdAt.toISOString()).split(" à ")[0]}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard className="size-3.5" aria-hidden="true" /> {sub.planName ? `Formule ${sub.planName}${sub.isTrial ? " (essai)" : ""}` : "Aucune formule"}
                </span>
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur lg:min-w-[300px]">
            <p className="flex items-center justify-between text-sm font-semibold">
              Sécurité du compte <span aria-label={`${done} points sur ${checks.length}`}>{done}/{checks.length}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#00e5ff,#14946a)] transition-[width] duration-700" style={{ width: `${(done / checks.length) * 100}%` }} />
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="size-4 text-[#5eead4]" aria-hidden="true" /> : <CircleAlert className="size-4 text-[#ffd166]" aria-hidden="true" />}
                  <span>
                    {c.label}
                    {c.detail ? <span className="text-white/70"> — {c.detail}</span> : null}
                  </span>
                  <span className="sr-only">{c.ok ? " (fait)" : " (à faire)"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsNav items={nav} />
        <div className="flex min-w-0 max-w-3xl flex-col gap-6">
          <Section id="compte" className="scroll-mt-24" title="Profil" description="Vos informations personnelles." icon={<UserRound />} tone="blue">
            <ProfileForm email={user.email} displayName={user.displayName} timezone={user.timezone} />
          </Section>

          {hasPlan ? (
            <Section id="formule" className="scroll-mt-24" title="Formule" icon={<CreditCard />} tone="green"
              description={
                <>
                  Formule actuelle : <strong className="text-ink">{sub.planName}</strong>
                  {sub.isTrial ? " (essai en cours)" : ""}. Un changement est proratisé par Stripe ; en cas de baisse de quotas, les surveillances excédentaires sont mises en pause,
                  jamais supprimées. Résiliation et factures :{" "}
                  <Link href="/app/abonnement" className="font-medium text-blue underline-offset-4 hover:underline">
                    page Abonnement
                  </Link>
                  .
                </>
              }
            >
              {billing ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {PAID_PLAN_IDS.map((id) => {
                    const p = PLAN_CATALOG[id];
                    const current = sub.planId === id;
                    return (
                      <li key={id} className={`flex flex-col gap-2 rounded-2xl border p-4 ${current ? "border-blue/40 bg-tint-blue" : "border-line bg-white/70"}`}>
                        <div className="flex items-baseline justify-between">
                          <span className="font-display font-bold">{p.name}</span>
                          <span className="font-display text-sm font-semibold tabular-nums">{formatCents(p.priceCents)} / mois</span>
                        </div>
                        <p className="text-sm text-ink-soft">{p.description}</p>
                        <div className="mt-auto pt-1">{current ? <Badge tone="gradient">Formule actuelle</Badge> : <PlanActions mode="change" planId={id} planName={p.name} />}</div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Callout tone="warning">Le changement de formule n'est pas disponible sur cet environnement.</Callout>
              )}
            </Section>
          ) : null}

          <Section id="notifications" className="scroll-mt-24" title="Notifications" description="Les alertes restent toujours visibles dans l'application. Le moteur de surveillance n'est pas modifié par ces choix." icon={<Bell />} tone="violet">
            <NotificationPrefs initial={prefs!} />
          </Section>

          <Section id="apparence" className="scroll-mt-24" title="Apparence et accessibilité" description="Adaptez l'affichage à votre confort." icon={<Palette />} tone="amber">
            <AppearanceSettings />
          </Section>

          <Section id="securite" className="scroll-mt-24" title="Sécurité" description="Mot de passe, double authentification et sessions ouvertes." icon={<Lock />} tone="red">
            <div className="flex flex-col gap-8">
              <div>
                <h3 className="mb-3 font-display text-base font-semibold">Mot de passe</h3>
                <PasswordForm />
              </div>
              <div id="double-authentification" className="scroll-mt-24 border-t border-line/70 pt-6">
                <h3 className="mb-3 font-display text-base font-semibold">Double authentification</h3>
                <div className="flex flex-col gap-4">
                  {mfaRequired ? <Callout tone="warning">La double authentification est obligatoire pour accéder à l'administration. Activez-la ci-dessous.</Callout> : null}
                  {recoveryUsed ? (
                    <Callout tone="warning">Vous vous êtes connecté avec un code de récupération : il n'est plus valable. Renouvelez vos codes si nécessaire.</Callout>
                  ) : null}
                  <MfaSettings enabled={user.mfa.enrolled} since={user.mfa.since} remainingCodes={remaining} />
                </div>
              </div>
              <div className="border-t border-line/70 pt-6">
                <h3 className="font-display text-base font-semibold">Sessions ouvertes</h3>
                <p className="mb-3 text-sm text-ink-soft">Les navigateurs où vous êtes connecté. Si vous ne reconnaissez pas une session, fermez-les toutes puis changez votre mot de passe.</p>
                <ul className="mb-4 flex flex-col divide-y divide-line/70 rounded-xl border border-line bg-white/70">
                  {sessions.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="flex items-center gap-2.5">
                        <ShieldCheck className="size-4 text-ink-soft" aria-hidden="true" />
                        <span className="font-medium">{describeUserAgent(x.userAgent)}</span>
                        {x.id === user.sessionId ? <Badge tone="success">Cette session</Badge> : null}
                      </span>
                      <span className="text-xs text-ink-soft">Active {formatRelative(x.lastSeenAt.toISOString())}</span>
                    </li>
                  ))}
                </ul>
                <CloseOtherSessions others={sessions.filter((x) => x.id !== user.sessionId).length} />
              </div>
            </div>
          </Section>

          <Section id="appareils" className="scroll-mt-24" title="Appareils et applications" description="Application sur téléphone et ordinateurs autorisés à effectuer vos contrôles locaux." icon={<Laptop />} tone="blue">
            <div className="flex flex-col gap-8">
              <div id="application-mobile" className="scroll-mt-24">
                <h3 className="mb-3 font-display text-base font-semibold">Application sur téléphone</h3>
                <InstallApp />
              </div>
              <div className="border-t border-line/70 pt-6">
                <h3 className="mb-1 font-display text-base font-semibold">Appareils reliés</h3>
                <p className="mb-3 text-sm text-ink-soft">Révoquez un appareil perdu ou que vous n'utilisez plus.</p>
                <DevicesList devices={devices} />
              </div>
            </div>
          </Section>

          <Section id="confidentialite" className="scroll-mt-24 border-danger/30" title="Confidentialité et données" description="Vos surveillances ne sont visibles que par vous." icon={<ShieldCheck />} tone="red">
            <div className="flex flex-col gap-6">
              <ul className="grid gap-2 text-sm sm:grid-cols-3">
                {(
                  [
                    ["/legal/confidentialite", "Politique de confidentialité"],
                    ["/legal/cookies", "Cookies"],
                    ["/legal/conditions-generales", "Conditions générales"],
                  ] as const
                ).map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="block rounded-xl border border-line bg-white/70 px-4 py-3 font-medium text-blue underline-offset-4 hover:bg-white hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-ink-soft">Pour toute question sur vos données (accès, rectification, portabilité), écrivez-nous depuis la page d'assistance.</p>
              <DangerZone />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
