import { siteConfig } from "@/lib/site";

/** Bandeau honnête sur le statut de lancement (aucune promesse de service commercial avant validation). */
export function LaunchBanner() {
  if (siteConfig.launchStatus === "live") return null;
  return (
    <div className="border-b border-line bg-ink px-4 py-2 text-center text-[13px] text-white">
      {siteConfig.launchStatus === "preview" ? (
        <>
          <strong className="font-semibold">Version de prévisualisation.</strong> Waverti n'est pas encore commercialisé : les
          paiements fonctionnent en mode test Stripe et aucun prélèvement réel n'est effectué.
        </>
      ) : (
        <>
          <strong className="font-semibold">Accès anticipé.</strong> Certaines fonctions sont encore en cours de finalisation.
        </>
      )}
    </div>
  );
}
