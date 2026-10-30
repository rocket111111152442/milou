import type { Metadata } from "next";
import { Callout, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@waverti/ui";
import { eq, profiles, withUser } from "@waverti/database";
import { requireUser } from "@/lib/auth";
import { listDevices } from "@/lib/data/account";
import { getDb } from "@/lib/db";
import { DangerZone, DevicesList, MfaSettings, NotificationPrefs, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ "double-authentification"?: string }> }) {
  const user = await requireUser("/app/parametres");
  const mfaRequired = (await searchParams)["double-authentification"] === "requise" && !user.mfa.enrolled;
  const [prefs] = await withUser(getDb(), user.id, (tx) =>
    tx
      .select({ notifyEmail: profiles.notifyEmail, notifyInapp: profiles.notifyInapp, notifyDesktop: profiles.notifyDesktop, marketingOptIn: profiles.marketingOptIn })
      .from(profiles)
      .where(eq(profiles.id, user.id)),
  );
  const devices = await listDevices(user.id);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Paramètres" description="Profil, notifications, sécurité et confidentialité." />
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
          <MfaSettings factorId={user.mfa.factorId} since={user.mfa.since} />
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
