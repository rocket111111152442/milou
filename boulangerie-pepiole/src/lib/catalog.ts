// Catalogue de la boutique.
// ⚠️ Les familles de produits viennent des descriptions publiques des boutiques
// (Office de tourisme de Sanary, MyBoulange, avis Google de Maison Sernesi).
// Seuls l'éclair et la tartelette au chocolat (2,80 €, étiquettes en vitrine à Six-Fours)
// ont un prix relevé ; les autres PRIX sont INDICATIFS et les photos sont des photos
// d'illustration : à remplacer par les vrais tarifs et produits.
// Prix en centimes.

export type CategoryId =
  | "pains"
  | "viennoiseries"
  | "patisseries"
  | "gateaux"
  | "snacking"
  | "boissons"
  | "formules";

export type Category = {
  id: CategoryId;
  label: string;
  tagline: string;
  image: string;
};

export const CATEGORIES: Category[] = [
  { id: "pains", label: "Pains", tagline: "Tradition, levain, campagne", image: "/images/p/levain.jpg" },
  { id: "viennoiseries", label: "Viennoiseries", tagline: "Feuilletées chaque matin", image: "/images/p/pain-chocolat.jpg" },
  { id: "patisseries", label: "Pâtisseries", tagline: "Fines et individuelles", image: "/images/p/tartelette-fruits.jpg" },
  { id: "gateaux", label: "Gâteaux à partager", tagline: "Entremets & tartes, sur commande", image: "/images/p/fraisier.jpg" },
  { id: "snacking", label: "Snacking", tagline: "Sandwichs, tartes salées, pizzas", image: "/images/p/sandwich-jambon.jpg" },
  { id: "boissons", label: "Pause café", tagline: "Boissons chaudes & fraîches", image: "/images/p/cafe.jpg" },
  { id: "formules", label: "Formules", tagline: "P'tit Déj' & déjeuner", image: "/images/pause-cafe.jpg" },
];

/** Un choix proposé au client (ex. « Boisson » : Café, Thé…). Le client en retient une option par choix. */
export type ProductGroup = { label: string; options: string[] };

export type Product = {
  id: string;
  name: string;
  category: CategoryId;
  price: number;
  unit?: string;
  description: string;
  image?: string;
  badges?: string[];
  /** Choix à faire avant d'ajouter au panier (formules…) */
  groups?: ProductGroup[];
  /** Délai de commande minimum en heures (sinon délai standard) */
  leadHours?: number;
  available?: boolean;
  featured?: boolean;
};

export const PRODUCTS: Product[] = [
  // Pains
  {
    id: "baguette-tradition",
    name: "Baguette de tradition",
    category: "pains",
    price: 140,
    description: "Farine de tradition française, longue fermentation, croûte craquante et mie alvéolée.",
    image: "/images/p/baguette-tradition.jpg",
    badges: ["Incontournable"],
    featured: true,
  },
  {
    id: "baguette",
    name: "Baguette",
    category: "pains",
    price: 120,
    description: "La baguette du quotidien, dorée et légère.",
    image: "/images/p/baguette.jpg",
  },
  {
    id: "pain-levain",
    name: "Pain au levain",
    category: "pains",
    price: 420,
    unit: "500 g",
    description: "Levain naturel et temps de pousse respectés : une mie dense, légèrement acidulée, qui se garde.",
    image: "/images/p/levain.jpg",
    featured: true,
  },
  {
    id: "pain-campagne",
    name: "Pain de campagne",
    category: "pains",
    price: 380,
    unit: "500 g",
    description: "Pain rustique à la croûte épaisse, parfait avec un bon fromage.",
    image: "/images/p/campagne.jpg",
  },
  {
    id: "pain-cereales",
    name: "Pain aux céréales",
    category: "pains",
    price: 420,
    unit: "400 g",
    description: "Graines de lin, tournesol, sésame : croustillant et généreux.",
    image: "/images/p/cereales.jpg",
  },
  {
    id: "pain-complet",
    name: "Pain complet",
    category: "pains",
    price: 360,
    unit: "400 g",
    description: "Farine complète, goût de noisette, riche en fibres.",
    image: "/images/p/complet.jpg",
  },
  {
    id: "pain-mie",
    name: "Pain de mie maison",
    category: "pains",
    price: 390,
    description: "Moelleux, idéal pour les tartines et croque-monsieur.",
    image: "/images/p/mie.jpg",
  },

  // Viennoiseries
  {
    id: "croissant",
    name: "Croissant",
    category: "viennoiseries",
    price: 130,
    description: "Feuilletage croustillant, cœur fondant. Le classique du matin.",
    image: "/images/p/croissant.jpg",
    featured: true,
  },
  {
    id: "pain-chocolat",
    name: "Pain au chocolat",
    category: "viennoiseries",
    price: 140,
    description: "Deux barres de chocolat dans un feuilletage doré.",
    image: "/images/p/pain-chocolat.jpg",
  },
  {
    id: "pain-raisins",
    name: "Pain aux raisins",
    category: "viennoiseries",
    price: 190,
    description: "Crème pâtissière et raisins, en spirale gourmande.",
    image: "/images/p/pain-raisins.jpg",
  },
  {
    id: "assortiment-viennoiseries",
    name: "Plateau de viennoiseries",
    category: "viennoiseries",
    price: 1500,
    unit: "12 mini-pièces",
    description: "Mini croissants, pains au chocolat et pains aux raisins. Pour un brunch ou une réunion.",
    image: "/images/p/assortiment.jpg",
    badges: ["Sur commande 24 h"],
    leadHours: 24,
  },

  // Pâtisseries individuelles
  {
    id: "tartelette-fruits",
    name: "Tartelette aux fruits de saison",
    category: "patisseries",
    price: 380,
    description: "Pâte sablée, crème pâtissière et fruits frais selon le marché.",
    image: "/images/p/tartelette-fruits.jpg",
    badges: ["Saison"],
    featured: true,
  },
  {
    id: "tarte-fraises",
    name: "Tartelette aux fraises",
    category: "patisseries",
    price: 420,
    description: "Fraises fraîches sur crème légère, nappage brillant.",
    image: "/images/p/tarte-fraises.jpg",
    badges: ["Saison"],
  },
  {
    id: "eclair-chocolat",
    name: "Éclair au chocolat",
    category: "patisseries",
    price: 280,
    description: "Pâte à choux garnie d'une crème intense au chocolat.",
    image: "/images/p/eclair-chocolat.jpg",
  },
  {
    id: "eclair-caramel",
    name: "Éclair caramel",
    category: "patisseries",
    price: 280,
    description: "Crème au caramel et glaçage doré.",
    image: "/images/p/eclair-caramel.jpg",
  },
  {
    id: "tartelette-chocolat",
    name: "Tartelette au chocolat",
    category: "patisseries",
    price: 280,
    description: "Pâte sablée et ganache fondante.",
    image: "/images/p/tarte-chocolat.jpg",
  },
  {
    id: "tropezienne",
    name: "Tropézienne",
    category: "patisseries",
    price: 390,
    description: "Brioche moelleuse au sucre perlé, garnie de crème légère. La gourmandise du Var.",
    badges: ["Spécialité"],
  },
  {
    id: "millefeuille",
    name: "Millefeuille",
    category: "patisseries",
    price: 380,
    description: "Feuilletage caramélisé et crème pâtissière vanillée.",
  },
  {
    id: "citron-meringuee",
    name: "Tarte au citron meringuée",
    category: "patisseries",
    price: 380,
    description: "Crème citron acidulée et meringue dorée au chalumeau.",
    image: "/images/p/citron-meringuee.jpg",
  },
  {
    id: "macarons",
    name: "Coffret de macarons",
    category: "patisseries",
    price: 1080,
    unit: "×6",
    description: "Assortiment de parfums du moment.",
    image: "/images/p/macarons.jpg",
  },

  // Gâteaux à partager
  {
    id: "fraisier",
    name: "Fraisier",
    category: "gateaux",
    price: 3200,
    unit: "6 parts",
    description: "Génoise, crème mousseline et fraises fraîches.",
    image: "/images/p/fraisier.jpg",
    badges: ["Sur commande 48 h", "Saison"],
    leadHours: 48,
    featured: true,
  },
  {
    id: "tropezienne-partager",
    name: "Tropézienne à partager",
    category: "gateaux",
    price: 2800,
    unit: "6 parts",
    description: "La grande tropézienne, pour les repas de famille et les anniversaires.",
    badges: ["Sur commande 48 h", "Spécialité"],
    leadHours: 48,
  },
  {
    id: "number-cake",
    name: "Number cake",
    category: "gateaux",
    price: 4500,
    unit: "8 à 10 parts",
    description: "Le gâteau en forme de chiffre ou de lettre, décoré de fruits, macarons et fleurs. Précisez le chiffre et les envies en commentaire.",
    badges: ["Sur commande 72 h"],
    leadHours: 72,
  },
  {
    id: "tarte-chocolat",
    name: "Tarte au chocolat",
    category: "gateaux",
    price: 2600,
    unit: "6 parts",
    description: "Ganache onctueuse sur pâte sablée cacao.",
    image: "/images/p/tarte-chocolat.jpg",
    badges: ["Sur commande 48 h"],
    leadHours: 48,
  },
  {
    id: "tarte-pommes",
    name: "Tarte aux pommes",
    category: "gateaux",
    price: 2200,
    unit: "6 parts",
    description: "Pommes fondantes et pâte croustillante, comme à la maison.",
    image: "/images/p/tarte-pommes.jpg",
    badges: ["Sur commande 48 h"],
    leadHours: 48,
  },
  {
    id: "entremets-cafe",
    name: "Entremets café",
    category: "gateaux",
    price: 3000,
    unit: "6 parts",
    description: "Biscuit imbibé, crème légère au café, cacao.",
    image: "/images/p/entremets-cafe.jpg",
    badges: ["Sur commande 48 h"],
    leadHours: 48,
  },

  // Snacking
  {
    id: "sandwich-jambon",
    name: "Sandwich jambon-fromage",
    category: "snacking",
    price: 550,
    description: "Sur baguette de tradition, beurre, jambon, fromage et salade.",
    image: "/images/p/sandwich-jambon.jpg",
    featured: true,
  },
  {
    id: "sandwich-crudites",
    name: "Sandwich crudités",
    category: "snacking",
    price: 550,
    description: "Légumes croquants, salade et sauce maison.",
    image: "/images/p/sandwich-crudites.jpg",
  },
  {
    id: "quiche",
    name: "Tarte salée du jour",
    category: "snacking",
    price: 420,
    unit: "la part",
    description: "Quiche ou tarte de légumes selon l'humeur du jour.",
    image: "/images/p/quiche.jpg",
  },
  {
    id: "pizza",
    name: "Pizza",
    category: "snacking",
    price: 350,
    unit: "la part",
    description: "Pâte à pain maison, sauce tomate et garnitures du jour.",
    image: "/images/p/pizza.jpg",
  },
  {
    id: "pissaladiere",
    name: "Pissaladière",
    category: "snacking",
    price: 320,
    unit: "la part",
    description: "La spécialité provençale : oignons fondants, anchois et olives.",
    badges: ["Provence"],
  },
  {
    id: "bruschetta",
    name: "Bruschetta",
    category: "snacking",
    price: 490,
    description: "Pain grillé, tomates, huile d'olive et herbes.",
  },
  {
    id: "salade",
    name: "Salade composée",
    category: "snacking",
    price: 750,
    description: "Fraîche et de saison, avec son petit pain.",
  },

  // Boissons
  {
    id: "cafe",
    name: "Café",
    category: "boissons",
    price: 150,
    description: "Expresso serré, pour la pause.",
    image: "/images/p/cafe.jpg",
  },
  {
    id: "cafe-creme",
    name: "Café crème",
    category: "boissons",
    price: 250,
    description: "Expresso et lait moussé.",
    image: "/images/p/cafe-creme.jpg",
  },
  {
    id: "chocolat-chaud",
    name: "Chocolat chaud",
    category: "boissons",
    price: 280,
    description: "Onctueux, pour les matins frais.",
    image: "/images/p/chocolat-chaud.jpg",
  },
  {
    id: "boisson-fraiche",
    name: "Boisson fraîche",
    category: "boissons",
    price: 200,
    description: "Eau, soda ou jus, selon le frigo du jour.",
  },

  // Formules
  {
    id: "formule-ptit-dej",
    name: "Formule P'tit Déj'",
    category: "formules",
    price: 390,
    description: "Une boisson chaude + une viennoiserie au choix.",
    image: "/images/pause-cafe.jpg",
    groups: [
      { label: "Boisson chaude", options: ["Expresso", "Café allongé", "Café crème", "Chocolat chaud", "Thé"] },
      { label: "Viennoiserie", options: ["Croissant au beurre", "Pain au chocolat", "Pain aux raisins"] },
    ],
    featured: true,
  },
  {
    id: "formule-dejeuner",
    name: "Formule Déjeuner",
    category: "formules",
    price: 950,
    description: "Un salé (sandwich ou part), une boisson et une pâtisserie individuelle, à choisir.",
    image: "/images/dejeuner.jpg",
    groups: [
      { label: "Salé", options: ["Sandwich jambon-fromage", "Sandwich crudités", "Part de tarte salée du jour", "Part de pizza", "Part de pissaladière"] },
      { label: "Boisson", options: ["Eau plate 50 cl", "Eau gazeuse 50 cl", "Coca-Cola 33 cl", "Orangina 25 cl", "Ice tea pêche 33 cl", "Jus d'orange 25 cl", "Expresso"] },
      { label: "Pâtisserie", options: ["Éclair au chocolat", "Éclair au caramel", "Tartelette au chocolat", "Tartelette aux fruits"] },
    ],
    featured: true,
  },
];

export const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
