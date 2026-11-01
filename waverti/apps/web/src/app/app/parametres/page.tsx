import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Callout, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@waverti/ui";
import { PAID_PLAN_IDS, PLAN_CATALOG } from "@waverti/billing/catalog";
import { formatCents } from "@waverti/types";
import { eq, profiles, withUser } from "@waverti/database";
import { remainingRecoveryCodes } from "@waverti/auth";
import { requireUser } from "@/lib/auth";
import { getSubscriptionView, listDevices } from "@/lib/data/account";
import { isBillingConfigured } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { InstallApp } from "@/components/pwa/install-app";
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
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Paramètres" description="Profil, notifications, sécurité et confidentialité." />
      {sub.subscriptionId ? (
        <Card id="formule">
          <CardHeader>
            <CardTitle as="h2">Formule</CardTitle>
            <p className="text-sm text-muted-fg">
              Formule actuelle : <strong className="text-ink">{sub.planName}</strong>
              {sub.isTrial ? " (essai en cours)" : ""}. Un changement est proratisé par Stripe ; en cas de baisse de quotas, les surveillances
              excédentaires sont mises en pause, jamais supprimées. Résiliation et factures :{" "}
              <Link href="/app/abonnement" className="font-medium text-blue underline-offset-4 hover:underline">
                page Abonnement
              </Link>
              .
            </p>
          </CardHeader>
          <CardContent>
            {billing ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {PAID_PLAN_IDS.map((id) => {
                  const p = PLAN_CATALOG[id];
                  const current = sub.planId === id;
                  return (
                    <li key={id} className="flex flex-col gap-2 rounded-2xl border border-line p-4">
                      <div className="flex items-baseline justify-between">
                        <span className="font-display font-bold">{p.name}</span>
                        <span className="font-display text-sm font-semibold tabular-nums">{formatCents(p.priceCents)} / mois</span>
                      </div>
                      <p className="text-sm text-muted-fg">{p.description}</p>
                      <div className="mt-auto pt-1">{current ? <Badge tone="gradient">Formule actuelle</Badge> : <PlanActions mode="change" planId={id} planName={p.name} />}</div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Callout tone="warning">Le changement de formule n'est pas disponible sur cet environnement.</Callout>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm email={user.email} displayName={user.displayName} timezone={user.timezone} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Notifications</CardTitle>
          <p className="text-sm text-muted-fg">Les alertes restent toujours visibles dans l'application. Le moteur de surveillance n'est pas modifié par ces choix.</p>
        </CardHeader>
        <CardContent>
          <NotificationPrefs initial={prefs!} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
      <Card id="double-authentification">
        <CardHeader>
          <CardTitle as="h2">Double authentification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mfaRequired ? <Callout tone="warning">La double authentification est obligatoire pour accéder à l'administration. Activez-la ci-dessous.</Callout> : null}
          {recoveryUsed ? (
            <Callout tone="warning">Vous vous êtes connecté avec un code de récupération : il n'est plus valable. Renouvelez vos codes si nécessaire.</Callout>
          ) : null}
          <MfaSettings enabled={user.mfa.enrolled} since={user.mfa.since} remainingCodes={remaining} />
        </CardContent>
      </Card>
      <Card id="application-mobile">
        <CardHeader>
          <CardTitle as="h2">Application sur téléphone</CardTitle>
        </CardHeader>
        <CardContent>
          <InstallApp />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Appareils reliés</CardTitle>
          <p className="text-sm text-muted-fg">Les ordinateurs autorisés à effectuer vos contrôles locaux. Révoquez un appareil perdu ou que vous n'utilisez plus.</p>
        </CardHeader>
        <CardContent>
          <DevicesList devices={devices} />
        </CardContent>
      </Card>
      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle as="h2">Confidentialité et données</CardTitle>
        </CardHeader>
        <CardContent>
          <DangerZone />
        </CardContent>
      </Card>
    </div>
  );
}
