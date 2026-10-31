"use client";
import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@waverti/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "other";

function detectPlatform(ua: string): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/**
 * Installation de Waverti sur l'écran d'accueil (PWA). Android/Chrome : invite native du navigateur.
 * iPhone/iPad : Safari n'a pas d'invite, des instructions sont affichées. Aucune boutique d'applications.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p className="text-sm text-muted-fg" data-testid="pwa-installed">
        Waverti est installé sur cet appareil et s'ouvre en plein écran.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid="pwa-install">
      <p className="text-sm text-muted-fg">
        Ajoutez Waverti à l'écran d'accueil de votre téléphone pour consulter vos alertes en un geste. Les contrôles restent
        effectués par les serveurs de Waverti : le téléphone n'exécute aucune surveillance et ne consomme pas de batterie
        pour cela.
      </p>
      {prompt ? (
        <Button
          className="self-start"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
        >
          <Smartphone aria-hidden="true" /> Installer l'application
        </Button>
      ) : platform === "ios" ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Ouvrez cette page dans Safari.</li>
          <li>Touchez le bouton Partager (carré avec une flèche).</li>
          <li>Choisissez « Sur l'écran d'accueil », puis « Ajouter ».</li>
        </ol>
      ) : (
        <p className="text-sm">
          Sur Android : menu du navigateur (⋮) puis « Installer l'application » ou « Ajouter à l'écran d'accueil ». Sur
          ordinateur, l'application Waverti pour Windows, macOS et Linux sera proposée après validation.
        </p>
      )}
    </div>
  );
}
