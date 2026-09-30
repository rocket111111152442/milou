export type ClubId = "six-fours" | "sanary";

export const CONTACT_EMAIL = "biorythme.sylvie@gmail.com";
export const PHONE = { label: "04 94 06 00 00", href: "+33494060000" };
export const FACEBOOK_URL = "https://www.facebook.com/pages/category/Gym-Physical-Fitness-Center/BiorythmeGym-387256081661907";

export type Club = {
  id: ClubId;
  name: string;
  short: string;
  city: string;
  address: string;
  phone: string;
  phoneHref: string;
  surface: string;
  pitch: string;
  features: string[];
  hours: { days: string; time: string }[];
  image: string;
  mapQuery: string;
};

export const CLUBS: Record<ClubId, Club> = {
  "six-fours": {
    id: "six-fours",
    name: "Biorythme Six-Fours",
    short: "Six-Fours",
    city: "Six-Fours-les-Plages",
    address: "429 boulevard de Léry, 83140 Six-Fours-les-Plages",
    phone: PHONE.label,
    phoneHref: PHONE.href,
    surface: "3000 m²",
    pitch:
      "Notre salle de 3000 m² à Six-Fours-les-Plages : fitness, musculation et cross training, 3 studios de cours collectifs et des coachs diplômés et expérimentés pour vous accompagner.",
    features: [
      "Studio Bike",
      "Studio Pump & Boxe",
      "Studio Zen & Freestyle",
      "Fitness",
      "Musculation",
      "Cross training",
      "Bilan individuel",
      "Programme personnalisé",
      "Suivi",
    ],
    hours: [
      { days: "Lundi – vendredi", time: "9h – 21h" },
      { days: "Samedi", time: "9h – 13h" },
      { days: "Dimanche", time: "Fermé" },
    ],
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=70",
    mapQuery: "Biorythme, 429 Boulevard de Lery, 83140 Six-Fours-les-Plages",
  },
  sanary: {
    id: "sanary",
    name: "Biorythme Sanary",
    short: "Sanary",
    city: "Sanary-sur-Mer",
    address: "6 rue Giboin, 83110 Sanary-sur-Mer",
    phone: PHONE.label,
    phoneHref: PHONE.href,
    surface: "500 m²",
    pitch:
      "Notre salle de 500 m² à Sanary-sur-Mer : une salle dédiée aux cours collectifs, un espace cardio-training et de la musculation guidée et libre, avec des coachs professionnels.",
    features: ["Salle de cours collectifs", "Cardio-training", "Musculation guidée", "Musculation libre", "Coachs professionnels"],
    hours: [
      { days: "Lundi, mardi, jeudi, vendredi", time: "9h – 21h" },
      { days: "Mercredi", time: "12h – 21h" },
      { days: "Samedi", time: "9h – 12h30" },
      { days: "Dimanche", time: "Fermé" },
    ],
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=70",
    mapQuery: "Biorythme, 6 Rue Giboin, 83110 Sanary-sur-Mer",
  },
};

/** Cours collectifs listés sur l'ancien site, par famille. */
export const COURSE_FAMILIES = [
  {
    name: "Renforcement musculaire",
    color: "var(--color-volt)",
    courses: ["Body Pump", "Cuisses Abdos Fessiers", "Abdos Flash", "CxWorx", "Tone"],
  },
  { name: "Cardio-training", color: "var(--color-blaze)", courses: ["RPM", "Body Attack", "Body Step", "GRIT", "Boxe"] },
  {
    name: "Danse",
    color: "#c084fc",
    courses: ["Latino Cardio", "Salsa", "Bachata", "Reggaeton", "Body Jam", "Modern Jazz"],
  },
  { name: "Étirements & postures", color: "var(--color-ice)", courses: ["Stretching", "Pilates", "Yoga Stretch", "Body Balance"] },
];

export const TZ = "Europe/Paris";
