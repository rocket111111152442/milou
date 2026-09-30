export type ClubId = "six-fours" | "sanary";

export const CONTACT_EMAIL = "biorythme.sylvie@gmail.com";

export const CLUBS: Record<
  ClubId,
  {
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
    hours: { days: string; time: string }[] | null;
    image: string;
    mapQuery: string;
  }
> = {
  "six-fours": {
    id: "six-fours",
    name: "Biorythme Six-Fours",
    short: "Six-Fours",
    city: "Six-Fours-les-Plages",
    address: "429 boulevard de Léry, 83140 Six-Fours-les-Plages",
    phone: "04 94 06 00 00",
    phoneHref: "+33494060000",
    surface: "3000 m²",
    pitch:
      "Un club de 3000 m² équipé des machines de dernière génération, avec 3 studios aux ambiances complètement différentes et de nombreux cours collectifs répartis sur toute la journée.",
    features: [
      "Studio Bike",
      "Studio Pump & Boxe",
      "Studio Zen & Freestyle",
      "Cardio-training",
      "Musculation",
      "Coachs diplômés",
    ],
    hours: null,
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=70",
    mapQuery: "Biorythme 429 boulevard de Léry Six-Fours-les-Plages",
  },
  sanary: {
    id: "sanary",
    name: "Biorythme Sanary",
    short: "Sanary",
    city: "Sanary-sur-Mer",
    address: "6 rue Giboin, 83110 Sanary-sur-Mer",
    phone: "04 94 26 55 41",
    phoneHref: "+33494265541",
    surface: "500 m²",
    pitch:
      "Un club de 500 m² avec une salle dédiée aux cours collectifs, un espace cardio-training et musculation guidée et libre, et du coaching individuel.",
    features: ["Salle de cours collectifs", "Cardio-training", "Musculation guidée & libre", "Coaching individuel"],
    hours: [
      { days: "Lundi, mardi, jeudi, vendredi", time: "9h – 21h" },
      { days: "Mercredi", time: "12h – 21h" },
      { days: "Samedi", time: "9h – 12h" },
      { days: "Dimanche", time: "Fermé" },
    ],
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=70",
    mapQuery: "Biorythme 6 rue Giboin Sanary-sur-Mer",
  },
};

export const TZ = "Europe/Paris";
