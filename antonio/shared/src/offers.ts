export const PLAN_IDS = ["essentiel", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const OFFERS = [
  { id: "essentiel", name: "Essentiel", euros: 20, description: "Le bon départ pour alléger votre quotidien.", accounts: 1, requests: 1000, voiceMinutes: 0, aiBudgetMicros: 3_000_000, features: ["Assistant à l’écrit", "1 compte mail et son agenda", "1 000 demandes écrites / mois", "Point quotidien et préférences", "Préparation avec validation"] },
  { id: "pro", name: "Pro", euros: 49, description: "Votre assistant, au rythme de votre activité.", accounts: 3, requests: 4000, voiceMinutes: 60, aiBudgetMicros: 10_000_000, features: ["Tout Essentiel", "3 comptes mail et leurs agendas", "4 000 demandes écrites / mois", "60 minutes de voix / mois", "Règles et modèles personnalisés"] },
  { id: "business", name: "Business", euros: 99, description: "Plus de capacité pour les journées bien remplies.", accounts: 6, requests: 10000, voiceMinutes: 180, aiBudgetMicros: 20_000_000, features: ["Tout Pro", "6 comptes mail et leurs agendas", "10 000 demandes écrites / mois", "180 minutes de voix / mois", "Un espace pour votre activité"] },
] as const;
export function offerFor(id: string | null | undefined) { return OFFERS.find((p) => p.id === id) ?? OFFERS[0]; }
