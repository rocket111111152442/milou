export type ActivityKind = "atelier" | "stage" | "evenement";

export type ActivityCategory =
  | "eveil"
  | "anglais"
  | "musique-danse"
  | "creatif"
  | "parentalite"
  | "bien-etre";

export interface Session {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
  /** Places disponibles (optionnel) */
  spots?: number | null;
  note?: string;
}

export interface Activity {
  id: string;
  slug: string;
  title: string;
  kind: ActivityKind;
  category: ActivityCategory;
  ageLabel: string;
  price: number;
  priceNote?: string;
  duration?: string;
  description: string;
  image: string;
  host?: string;
  recurring?: string;
  published: boolean;
  featured?: boolean;
  sessions: Session[];
  updatedAt?: string;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  /** Markdown */
  content: string;
  tags: string[];
  published: boolean;
  /** ISO date */
  date: string;
  updatedAt?: string;
}

export type RequestType = "reservation-table" | "atelier" | "anniversaire" | "contact";

export interface ContactRequest {
  id: string;
  type: RequestType;
  createdAt: string;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  /** Champs spécifiques (date, heure, nb personnes, âge, atelier...) */
  details: Record<string, string>;
  status: "nouveau" | "traite";
}

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  eveil: "Éveil & sensoriel",
  anglais: "Anglais",
  "musique-danse": "Musique & danse",
  creatif: "Créatif & gourmand",
  parentalite: "Parentalité",
  "bien-etre": "Bien-être",
};

export const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  eveil: "bg-sage",
  anglais: "bg-tomato",
  "musique-danse": "bg-mustard",
  creatif: "bg-orange",
  parentalite: "bg-coral",
  "bien-etre": "bg-olive",
};

export const KIND_LABELS: Record<ActivityKind, string> = {
  atelier: "Atelier",
  stage: "Stage vacances",
  evenement: "Événement",
};
