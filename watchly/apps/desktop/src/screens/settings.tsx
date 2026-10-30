import * as React from "react";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";
import { ExternalLink } from "lucide-react";
import { Badge, Button, Callout, Card, Dialog, DialogClose, DialogContent, DialogTrigger, PageHeader, Switch, useToast } from "@watchly/ui";
import { api } from "../lib/api";
import { native, type AppInfo } from "../lib/native";
import { notificationsAllowed, showDesktopNotification } from "../lib/notify";
import type { Me } from "./consent";

function Row({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl">
        <p className="font-medium">{title}</p>
        {description ? <div className="mt-0.5 text-sm text-muted-fg">{description}</div> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function SettingsPage({
  info,
  me,
  paused,
  onPausedChange,
  onConsentChange,
  onUnlinked,
}: {
  info: AppInfo;
  me: Me;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  onConsentChange: () => void;
  onUnlinked: () => void;
}) {
  const { push } = useToast();
  const [autostart, setAutostart] = React.useState<boolean | null>(null);
  const [notifOk, setNotifOk] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [update, setUpdate] = React.useState<string | null>(null);

  React.useEffect(() => {
    autostartEnabled().then(setAutostart).catch(() => setAutostart(null));
    notificationsAllowed().then(setNotifOk);
  }, []);

  const consentAccepted = me.consent.accepted && Boolean(me.device?.monitoringEnabled);

  const withdraw = async () => {
    setBusy("consent");
    try {
      await api("POST", "/api/agent/consent", { accepted: false, consentVersion: me.consent.version });
      push({ tone: "success", title: "Accord retiré", description: "Plus aucun contrôle n'est effectué sur cet ordinateur." });
      onConsentChange();
    } catch (e) {
      push({ tone: "error", title: "Action impossible", description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const unlink = async () => {
    setBusy("unlink");
    await native.unlink().catch(() => undefined);
    setBusy(null);
    onUnlinked();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Paramètres" />

      <Card className="px-5">
        <Row title="Compte" description={`${me.user.email} · ${me.plan.name ? `Formule ${me.plan.name}${me.plan.isTrial ? " (essai)" : ""}` : "Aucun abonnement actif"}`}>
          <Button variant="secondary" size="sm" onClick={() => void native.openExternal(`${info.apiBase}/app/abonnement`)}>
            Gérer l'abonnement <ExternalLink aria-hidden="true" />
          </Button>
        </Row>
        <Row
          title="Contrôles sur cet ordinateur"
          description={
            consentAccepted
              ? "Vous avez accepté que vos contrôles de pages soient effectués ici."
              : "Aucun contrôle n'est effectué sur cet ordinateur tant que vous n'avez pas donné votre accord."
          }
        >
          {consentAccepted ? (
            <Button variant="secondary" size="sm" loading={busy === "consent"} onClick={() => void withdraw()}>
              Retirer mon accord
            </Button>
          ) : (
            <Button size="sm" onClick={onConsentChange}>
              Lire et accepter
            </Button>
          )}
        </Row>
        <Row title="Pause" description="Suspend les contrôles de cet ordinateur sans retirer votre accord. Aussi disponible depuis l'icône Watchly.">
          <Switch checked={paused} onCheckedChange={onPausedChange} aria-label="Mettre en pause les contrôles sur cet ordinateur" />
        </Row>
        <Row title="Lancer Watchly à l'ouverture de session" description="Désactivé par défaut. L'icône Watchly reste visible dans la zone de notification.">
          <Switch
            checked={autostart === true}
            disabled={autostart === null}
            aria-label="Lancer Watchly à l'ouverture de session"
            onCheckedChange={async (v) => {
              try {
                if (v) await enableAutostart();
                else await disableAutostart();
                setAutostart(await autostartEnabled());
              } catch {
                push({ tone: "error", title: "Réglage impossible sur ce système" });
              }
            }}
          />
        </Row>
        <Row
          title="Notifications du bureau"
          description={notifOk ? "Autorisées." : "Non autorisées : les alertes restent visibles dans l'onglet Alertes."}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const ok = await notificationsAllowed(true);
              setNotifOk(ok);
              if (ok) await showDesktopNotification({ title: "Watchly", body: "Les notifications fonctionnent.", taskName: null });
            }}
          >
            {notifOk ? "Envoyer un test" : "Autoriser"}
          </Button>
        </Row>
      </Card>

      <Card className="px-5">
        <Row title="Cet ordinateur" description={`${me.device?.name ?? info.hostname} · Watchly ${info.version} · ${info.platform}`} />
        <Row
          title="Stockage de la liaison"
          description={
            info.storage === "keyring"
              ? "Dans le trousseau sécurisé du système."
              : "Dans un fichier lisible par votre seul compte utilisateur (trousseau du système indisponible)."
          }
        >
          <Badge tone={info.storage === "keyring" ? "success" : "warning"}>{info.storage === "keyring" ? "Trousseau" : "Fichier protégé"}</Badge>
        </Row>
        <Row
          title="Mises à jour"
          description={
            info.updaterAvailable
              ? (update ?? "Les mises à jour sont signées et vérifiées avant installation.")
              : "Cette version n'intègre pas la mise à jour automatique : téléchargez les nouvelles versions depuis le site Watchly."
          }
        >
          {info.updaterAvailable ? (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "update"}
              onClick={async () => {
                setBusy("update");
                try {
                  const u = await native.checkUpdate();
                  setUpdate(u ? `Version ${u.version} disponible.` : "Watchly est à jour.");
                  if (u) await native.installUpdate();
                } catch (e) {
                  setUpdate(typeof e === "string" ? e : "Vérification impossible.");
                } finally {
                  setBusy(null);
                }
              }}
            >
              Rechercher une mise à jour
            </Button>
          ) : null}
        </Row>
        <Row title="Serveur" description={info.apiBase} />
        {info.devAllowLocal ? (
          <Callout tone="warning" className="my-4">
            Mode développement : les adresses locales sont autorisées pour les tests. Ce mode n'existe pas dans les versions publiées.
          </Callout>
        ) : null}
      </Card>

      <Card className="px-5">
        <Row title="Délier cet ordinateur" description="Le jeton de cet ordinateur est révoqué et effacé. Vos surveillances restent dans votre compte.">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger" size="sm">
                Délier
              </Button>
            </DialogTrigger>
            <DialogContent title="Délier cet ordinateur ?" description="Il faudra le relier de nouveau pour qu'il effectue des contrôles.">
              <div className="mt-6 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="secondary">Annuler</Button>
                </DialogClose>
                <Button variant="danger" loading={busy === "unlink"} onClick={() => void unlink()}>
                  Délier
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </Row>
      </Card>
    </div>
  );
}
