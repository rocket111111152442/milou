"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Laptop, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Callout, Dialog, DialogClose, DialogContent, DialogTrigger, Field, Input, Label, Select, Switch } from "@watchly/ui";
import { formatDateTime, formatRelative, type DeviceView } from "@watchly/types";
import { apiCall, useApiAction } from "@/components/app/use-api";

const ZONES = ["Europe/Paris", "Europe/Brussels", "Europe/Zurich", "Europe/Luxembourg", "America/Montreal", "Indian/Reunion", "America/Martinique", "America/Guadeloupe", "Pacific/Noumea", "Pacific/Tahiti", "UTC"];

export function ProfileForm({ email, displayName, timezone }: { email: string; displayName: string | null; timezone: string }) {
  const [name, setName] = useState(displayName ?? "");
  const [tz, setTz] = useState(timezone);
  const { run, pending } = useApiAction();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run("/api/account/profile", { displayName: name || null, timezone: tz }, { method: "PATCH", success: "Profil enregistré" });
      }}
    >
      <Field id="p-email" label="Adresse e-mail" hint="Pour modifier votre adresse, contactez l'assistance.">
        {(p) => <Input {...p} value={email} disabled readOnly />}
      </Field>
      <Field id="p-name" label="Prénom ou pseudo">
        {(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field id="p-tz" label="Fuseau horaire">
        {(p) => (
          <Select {...p} value={tz} onChange={(e) => setTz(e.target.value)}>
            {[...new Set([tz, ...ZONES])].map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button type="submit" loading={pending} className="self-start">
        Enregistrer
      </Button>
    </form>
  );
}

export function NotificationPrefs({ initial }: { initial: { notifyEmail: boolean; notifyInapp: boolean; notifyDesktop: boolean; marketingOptIn: boolean } }) {
  const [s, setS] = useState(initial);
  const { run } = useApiAction();
  const toggle = (key: keyof typeof s, label: string) => (v: boolean) => {
    setS((x) => ({ ...x, [key]: v }));
    void run("/api/account/profile", { [key]: v }, { method: "PATCH", success: `${label} : ${v ? "activé" : "désactivé"}` });
  };
  const rows: Array<[keyof typeof s, string, string]> = [
    ["notifyEmail", "Alertes par e-mail", "Selon votre formule (Plus et au-delà)."],
    ["notifyDesktop", "Notifications du bureau", "Affichées par l'application installée."],
    ["marketingOptIn", "Nouveautés de Watchly", "Un e-mail occasionnel, désinscription à tout moment."],
  ];
  return (
    <div className="flex flex-col divide-y divide-line">
      {rows.map(([key, label, hint]) => (
        <div key={key} className="flex items-center justify-between gap-4 py-3">
          <div>
            <Label htmlFor={`n-${key}`}>{label}</Label>
            <p className="text-xs text-muted-fg">{hint}</p>
          </div>
          <Switch id={`n-${key}`} checked={s[key]} onCheckedChange={toggle(key, label)} />
        </div>
      ))}
    </div>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { run, pending } = useApiAction();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run("/api/account/password", { current, next }, { success: "Mot de passe modifié. Vos autres sessions ont été déconnectées." });
        if (r) {
          setCurrent("");
          setNext("");
        }
      }}
    >
      <Field id="pw-current" label="Mot de passe actuel" required>
        {(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
      </Field>
      <Field id="pw-next" label="Nouveau mot de passe" required hint="10 caractères minimum, lettres et chiffres ou symboles.">
        {(p) => <Input {...p} type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <Button type="submit" variant="secondary" loading={pending} className="self-start" disabled={!current || next.length < 10}>
        Changer le mot de passe
      </Button>
    </form>
  );
}

export function MfaSettings({ factorId, since }: { factorId: string | null; since: string | null }) {
  const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const { run, pending } = useApiAction();
  const cleanCode = code.replace(/\s/g, "");
  const codeField = (id: string) => (
    <Field id={id} label="Code à 6 chiffres" required hint="Affiché par votre application d'authentification.">
      {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="max-w-40" />}
    </Field>
  );

  if (factorId) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(`/api/account/mfa/${factorId}`, { code: cleanCode }, { method: "DELETE", success: "Double authentification désactivée" })) setCode("");
        }}
      >
        <p className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          <span>
            <strong>Double authentification activée</strong>
            {since ? ` depuis le ${formatDateTime(since)}` : ""}. Un code est demandé à chaque connexion.
          </span>
        </p>
        {codeField("mfa-disable-code")}
        <Button type="submit" variant="secondary" loading={pending} className="self-start" disabled={!/^\d{6}$/.test(cleanCode)}>
          Désactiver la double authentification
        </Button>
      </form>
    );
  }

  if (!setup) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-fg">
          En plus du mot de passe, un code temporaire généré par une application d'authentification (Google Authenticator, Microsoft
          Authenticator, 1Password, Aegis…) sera demandé à chaque connexion.
        </p>
        <Button
          className="self-start"
          loading={pending}
          onClick={async () => {
            const r = await run<{ factorId: string; qrCode: string; secret: string }>("/api/account/mfa", {}, { refresh: false });
            if (r) setSetup(r);
          }}
        >
          Activer la double authentification
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run("/api/account/mfa/verify", { factorId: setup.factorId, code: cleanCode }, { success: "Double authentification activée" })) {
          setSetup(null);
          setCode("");
        }
      }}
    >
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>Scannez ce QR code avec votre application d'authentification, ou saisissez la clé ci-dessous.</li>
        <li>Saisissez le code à 6 chiffres affiché par l'application pour confirmer.</li>
      </ol>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* QR code SVG fourni par le serveur d'authentification (data URI, aucune ressource externe). */}
        <img src={setup.qrCode} alt="QR code de configuration de la double authentification" width={176} height={176} className="rounded-lg border border-line bg-white p-2" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-fg">Clé de configuration</span>
          <code data-testid="mfa-secret" className="break-all rounded-md bg-surface px-2 py-1 font-mono text-sm">
            {setup.secret}
          </code>
        </div>
      </div>
      {codeField("mfa-enroll-code")}
      <div className="flex gap-2">
        <Button type="submit" loading={pending} disabled={!/^\d{6}$/.test(cleanCode)}>
          Confirmer l'activation
        </Button>
        <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function DevicesList({ devices }: { devices: DeviceView[] }) {
  const { run, pending } = useApiAction();
  if (!devices.length) {
    return (
      <p className="text-sm text-muted-fg">
        Aucun appareil relié. <a href="/telecharger" className="text-blue underline-offset-4 hover:underline">Télécharger l'application</a>
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {devices.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
          <span className="flex items-center gap-3">
            <Laptop className="size-4 text-muted" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{d.name}</span>
              <span className="text-xs text-muted-fg">
                {d.platform} · {d.online ? "en ligne" : `vu ${formatRelative(d.lastSeenAt)}`}
                {d.appVersion ? ` · v${d.appVersion}` : ""}
                {d.monitoringEnabled ? " · contrôles locaux actifs" : " · contrôles locaux inactifs"}
              </span>
            </span>
          </span>
          <Button variant="ghost" size="sm" loading={pending} onClick={() => run(`/api/devices/${d.id}`, undefined, { method: "DELETE", success: "Appareil révoqué" })}>
            Révoquer
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function DangerZone() {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Exporter mes données</p>
          <p className="text-xs text-muted-fg">Fichier JSON contenant votre profil, vos surveillances, résultats et alertes.</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <a href="/api/account/export">
            <Download aria-hidden="true" /> Exporter
          </a>
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-danger">Supprimer mon compte</p>
          <p className="text-xs text-muted-fg">Abonnement résilié immédiatement, données supprimées définitivement.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" size="sm">
              <Trash2 aria-hidden="true" /> Supprimer
            </Button>
          </DialogTrigger>
          <DialogContent title="Supprimer définitivement votre compte ?" description="Cette action est irréversible. Tapez SUPPRIMER pour confirmer.">
            <div className="flex flex-col gap-4">
              <Field id="del-confirm" label="Confirmation">
                {(p) => <Input {...p} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />}
              </Field>
              {error ? <Callout tone="danger">{error}</Callout> : null}
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Annuler</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  loading={busy}
                  disabled={confirmation !== "SUPPRIMER"}
                  onClick={async () => {
                    setBusy(true);
                    const r = await apiCall("/api/account/delete", { body: { confirmation } });
                    setBusy(false);
                    if (!r.ok) return setError(r.error.message ?? "Suppression impossible.");
                    router.push("/?compte=supprime");
                  }}
                >
                  Supprimer mon compte
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
