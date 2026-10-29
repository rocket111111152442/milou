export const BRAND = {
  name: "Watchly",
  publisher: "LULLIN WEB",
  publisherUrl: "https://www.lullin-web.com",
  tagline: "Ne cherchez plus. Watchly le fait pour vous.",
} as const;

export const COLORS = {
  white: "#FFFFFF",
  ink: "#111118",
  surface: "#F8F9FC",
  muted: "#777785",
  cyan: "#00E5FF",
  blue: "#245BFF",
  violet: "#8028FF",
  pink: "#ED4DF5",
} as const;

export const GRADIENT = "linear-gradient(90deg, #00E5FF, #245BFF, #8028FF, #ED4DF5)";

/** Version du texte de consentement au fonctionnement local de l'application desktop. */
export const LOCAL_CONSENT_VERSION = "2026-10-29";
export const LOCAL_CONSENT_TEXT =
  "Watchly utilise les ressources de votre ordinateur et votre connexion Internet pour effectuer vos surveillances lorsque l'application fonctionne. Selon votre abonnement, nos serveurs peuvent reprendre les contrôles lorsque votre ordinateur est indisponible.";

export const USER_AGENT = "WatchlyBot/0.1 (+https://watchly.lullin-web.com/robot)";
