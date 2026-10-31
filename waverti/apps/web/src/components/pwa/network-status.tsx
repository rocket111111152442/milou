"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Bandeau affiché dans l'espace client quand la connexion est perdue (téléphone en particulier). */
export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        Connexion perdue. Les informations affichées peuvent ne plus être à jour ; vos surveillances continuent sur les
        serveurs de Waverti. Les modifications seront possibles au retour de la connexion.
      </p>
    </div>
  );
}
