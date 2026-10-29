import * as React from "react";
import { ExternalLink, Laptop, RefreshCw } from "lucide-react";
import { Button, Callout, Card, Field, Input, Logo } from "@watchly/ui";
import { native, type AppInfo, type LinkStart } from "../lib/native";

type Phase = "idle" | "starting" | "waiting" | "expired" | "error";

/**
 * Liaison de l'ordinateur au compte, sans saisie de mot de passe dans l'application :
 * l'utilisateur valide un code court sur le site Watchly, dans son navigateur, déjà connecté.
 */
export function LinkScreen({ info, onLinked }: { info: AppInfo; onLinked: () => void }) {
  const [deviceName, setDeviceName] = React.useState(info.hostname);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [link, setLink] = React.useState<LinkStart | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [browserFailed, setBrowserFailed] = React.useState(false);

  React.useEffect(() => {
    if (phase !== "waiting" || !link) return;
    let stopped = false;
    const deadline = Date.now() + link.expiresIn * 1000;
    const poll = async () => {
      if (stopped) return;
      if (Date.now() > deadline) {
        setPhase("expired");
        return;
      }
      try {
        const status = await native.linkPoll();
        if (status === "approved") return onLinked();
        if (status === "expired" || status === "invalid" || status === "consumed") return setPhase("expired");
        if (status === "denied") {
          setError("La liaison a été refusée depuis le site.");
          return setPhase("error");
        }
      } catch {
        // Réseau momentanément indisponible : on continue d'interroger jusqu'à l'expiration.
      }
      window.setTimeout(poll, Math.max(3, link.interval) * 1000);
    };
    const t = window.setTimeout(poll, link.interval * 1000);
    return () => {
      stopped = true;
      window.clearTimeout(t);
    };
  }, [phase, link, onLinked]);

  const start = async () => {
    setPhase("starting");
    setError(null);
    let l: LinkStart;
    try {
      l = await native.linkStart(deviceName.trim() || info.hostname);
    } catch (e) {
      setError(typeof e === "string" ? e : "Impossible de joindre le serveur Watchly.");
      setPhase("error");
      return;
    }
    setLink(l);
    setPhase("waiting");
    // Si le navigateur ne s'ouvre pas, le code et l'adresse restent affichés pour une ouverture manuelle.
    setBrowserFailed(false);
    await native.openExternal(l.verificationUrl).catch(() => setBrowserFailed(true));
  };

  return (
    <main className="grid min-h-full place-items-center bg-surface px-4 py-10">
      <Card className="w-full max-w-lg p-8">
        <Logo className="h-7" />
        <h1 className="mt-8 font-display text-2xl font-bold tracking-tight">Reliez cet ordinateur à votre compte</h1>
        <p className="mt-2 text-sm text-muted-fg">
          Watchly va ouvrir une page de votre navigateur. Connectez-vous à votre compte et vérifiez que le code affiché ci-dessous est
          identique, puis validez. Aucun mot de passe n'est saisi dans l'application.
        </p>

        {phase === "waiting" && link ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm text-muted-fg">Code à vérifier sur le site</p>
            <p className="font-mono text-4xl font-bold tracking-[0.2em]" aria-live="polite">
              {link.userCode}
            </p>
            {browserFailed ? (
              <p className="text-sm text-muted-fg">
                Le navigateur n'a pas pu être ouvert. Rendez-vous sur <span className="break-all font-medium text-ink">{link.verificationUrl}</span>
              </p>
            ) : null}
            <p className="flex items-center gap-2 text-sm text-muted-fg">
              <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> En attente de votre validation…
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void native.openExternal(link.verificationUrl)}>
                <ExternalLink aria-hidden="true" /> Rouvrir la page de validation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void native.linkCancel();
                  setPhase("idle");
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-5">
            <Field id="device-name" label="Nom de cet ordinateur" hint="Visible dans la liste de vos appareils sur le site.">
              {(p) => <Input {...p} value={deviceName} maxLength={80} onChange={(e) => setDeviceName(e.target.value)} />}
            </Field>
            {phase === "expired" ? (
              <Callout tone="warning" title="Code expiré">
                Le code n'a pas été validé à temps. Recommencez.
              </Callout>
            ) : null}
            {error ? (
              <Callout tone="danger" role="alert">
                {error}
              </Callout>
            ) : null}
            <Button size="lg" onClick={() => void start()} loading={phase === "starting"}>
              <Laptop aria-hidden="true" /> Relier cet ordinateur
            </Button>
            <p className="text-center text-sm text-muted-fg">
              Pas encore de compte ?{" "}
              <button type="button" className="font-medium text-blue hover:underline" onClick={() => void native.openExternal(`${info.apiBase}/inscription`)}>
                Créer un compte gratuit
              </button>
            </p>
          </div>
        )}
        <p className="mt-8 text-xs text-muted-fg">
          Serveur : {info.apiBase} · Version {info.version}
        </p>
      </Card>
    </main>
  );
}
