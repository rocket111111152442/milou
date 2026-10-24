import type {
  Addon,
  AtelierSettings,
  Category,
  Content,
  DeliverySettings,
  Faq,
  GalleryItem,
  Occasion,
  Product,
  PromoCode,
  Review,
  Settings,
} from "./types";

// Photos libres de droits (Unsplash) en attendant les photos des créations de la Maison.
export const u = (id: string) => `https://images.unsplash.com/photo-${id}`;

export const IMG = {
  darkBouquet: u("1487530811176-3780de880c2d"),
  darkRed: u("1457089328109-e5d9bd499191"),
  dahliaDark: u("1444021465936-c6ca81d39b84"),
  whiteRoseDark: u("1495231916356-a86217efff12"),
  brideDark: u("1519741497674-611481863552"),
  pastel: u("1563241527-3004b7be0ffd"),
  peonies: u("1582794543139-8ac9cb0f7b11"),
  shopFront: u("1487070183336-b863922373d4"),
  redRoses: u("1494972308805-463bc619d34e"),
  redRoseDark: u("1496062031456-07b8f162a322"),
  vaseColor: u("1533616688419-b7a585564566"),
  tulips: u("1561181286-d3fee7d55364"),
  pinkBouquet: u("1591886960571-74d43a9d4166"),
  roseVase: u("1518895949257-7621c3c786d7"),
  daisyBlack: u("1508784411316-02b8cd4d3a3a"),
  chrysanthemum: u("1460039230329-eb070fc6c77c"),
  eucalyptus: u("1466781783364-36c955e42a7f"),
  topiary: u("1520412099551-62b6bafeb5bb"),
  monstera: u("1525498128493-380d1990a112"),
  aloe: u("1509423350716-97f9360b4e09"),
  ficus: u("1501004318641-b39e6451bec6"),
  bonsai: u("1512428813834-c702c7702b78"),
  weddingChairs: u("1522673607200-164d1b6ce486"),
  lavender: u("1499002238440-d264edd596ec"),
  dried: u("1558603668-6570496b66f8"),
  magnolia: u("1474112704314-8162b7749a90"),
  monsteraDark: u("1503149779833-1de50ebe5f8a"),
  kraftBouquet: u("1567696153798-9111f9cd3d0d"),
  fern: u("1599148401005-fe6d7497cb5e"),
  milkyWay: u("1444703686981-a3abbc4d4fe3"),
  peachRoses: u("1572454591674-2739f30d8c40"),
  hydrangea: u("1471696035578-3d8c78d99684"),
  pinkRosesDark: u("1464982326199-86f32f81b211"),
  whiteKraftDark: u("1523694576729-dc99e9c0f9b4"),
  roseWall: u("1581938165093-050aeb5ef218"),
  houseplants: u("1592150621744-aca64f48394a"),
  whitePinkRoses: u("1596438459194-f275f413d6ff"),
  bougainvillea: u("1599598425947-5202edd56bdb"),
  rings: u("1606800052052-a08af7148866"),
  peony: u("1527061011665-3652c757a4d4"),
  roseGarden: u("1585320806297-9794b3e4eeae"),
  starryMountain: u("1519681393784-d120267933ba"),
  pinkRoseDark: u("1455582916367-25f75bfc6710"),
  pinkDahlia: u("1507290439931-a861b5a38200"),
  roseBook: u("1518621736915-f3b1c41bfd00"),
  handsFern: u("1542601906990-b4d3fb778b09"),
  leavesDark: u("1551970634-747846a548cb"),
  weddingHands: u("1465495976277-4387d4b0b4c6"),
  weddingAisle: u("1469371670807-013ccf25f16a"),
  weddingTable: u("1519225421980-715cb0215aed"),
  fiddleLeaf: u("1453904300235-0f2f60b15b5d"),
  tulipsField: u("1524386416438-98b9b2d4b433"),
};

const now = "2026-10-01T09:00:00.000Z";

export const seedCategories: Category[] = [
  { id: "cat_bouquets", slug: "bouquets", name: "Bouquets", description: "Des bouquets de saison composés à la main, façon jardin à l'anglaise.", image: IMG.darkBouquet, active: true, showInMenu: true, sortOrder: 1 },
  { id: "cat_compositions", slug: "compositions", name: "Compositions", description: "Centres de table, coupes et compositions piquées pour la maison et la réception.", image: IMG.vaseColor, active: true, showInMenu: true, sortOrder: 2 },
  { id: "cat_plantes", slug: "plantes", name: "Plantes", description: "Plantes vertes, fleuries et curiosités botaniques choisies une à une.", image: IMG.monsteraDark, active: true, showInMenu: true, sortOrder: 3 },
  { id: "cat_sechees", slug: "fleurs-sechees", name: "Fleurs séchées", description: "Des compositions qui traversent les saisons, sans arrosage.", image: IMG.dried, active: true, showInMenu: true, sortOrder: 4 },
  { id: "cat_deuil", slug: "deuil", name: "Deuil & hommage", description: "Couronnes, gerbes et dessus de cercueil, livrés aux funérariums et lieux de culte.", image: IMG.whiteRoseDark, active: true, showInMenu: true, sortOrder: 5 },
  { id: "cat_fetes", slug: "fetes-et-saisons", name: "Fêtes & saisons", description: "Toussaint, Noël, Saint-Valentin, fête des mères : les créations du moment.", image: IMG.chrysanthemum, active: true, showInMenu: true, sortOrder: 6 },
];

export const seedOccasions: Occasion[] = [
  ["amour", "Amour"],
  ["anniversaire", "Anniversaire"],
  ["merci", "Merci"],
  ["naissance", "Naissance"],
  ["retablissement", "Prompt rétablissement"],
  ["juste-parce-que", "Juste parce que"],
  ["deuil", "Deuil"],
  ["toussaint", "Toussaint"],
  ["fete-des-meres", "Fête des mères"],
  ["saint-valentin", "Saint-Valentin"],
  ["noel", "Noël"],
  ["maison", "Pour la maison"],
].map(([slug, name], i) => ({ id: `occ_${slug.replace(/-/g, "_")}`, slug, name, active: true, sortOrder: i + 1 }));

const occ = (...slugs: string[]) => slugs.map((s) => `occ_${s.replace(/-/g, "_")}`);

type P = Omit<Product, "id" | "slug" | "variants" | "createdAt" | "updatedAt" | "sortOrder" | "stock" | "active" | "featured" | "isNew" | "seasonal" | "compareAtPrice" | "tags" | "occasionIds" | "colors"> &
  Partial<Product> & { tiers?: [number, number, number] | null };

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function product(p: P, i: number): Product {
  const slug = p.slug || slugify(p.name);
  const base = p.price;
  const tiers = p.tiers === null ? null : p.tiers || [1, 1.4, 1.9];
  const variants = tiers
    ? [
        { id: `${slug}-classique`, name: "Classique", price: Math.round((base * tiers[0]) / 100) * 100 },
        { id: `${slug}-genereux`, name: "Généreux", price: Math.round((base * tiers[1]) / 100) * 100 },
        { id: `${slug}-somptueux`, name: "Somptueux", price: Math.round((base * tiers[2]) / 100) * 100 },
      ]
    : [];
  return {
    id: `prd_${slug.replace(/-/g, "_")}`,
    slug,
    name: p.name,
    subtitle: p.subtitle,
    description: p.description,
    details: p.details,
    categoryId: p.categoryId,
    occasionIds: p.occasionIds || [],
    price: base,
    compareAtPrice: p.compareAtPrice ?? null,
    variants,
    images: p.images,
    stock: p.stock ?? null,
    active: p.active ?? true,
    featured: p.featured ?? false,
    isNew: p.isNew ?? false,
    seasonal: p.seasonal ?? false,
    deliveryOnly: p.deliveryOnly,
    pickupOnly: p.pickupOnly,
    colors: p.colors || [],
    tags: p.tags || [],
    star: p.star,
    sortOrder: i + 1,
    createdAt: now,
    updatedAt: now,
  };
}

const care =
  "Recoupez les tiges en biseau de 2 cm, changez l'eau tous les deux jours et éloignez le bouquet des fruits et des sources de chaleur.";

export const seedProducts: Product[] = (
  [
    // ---------------- Bouquets ----------------
    { name: "Andromeda", subtitle: "Bouquet romantique, roses poudrées", price: 4000, categoryId: "cat_bouquets", occasionIds: occ("amour", "anniversaire", "merci"), images: [IMG.pinkBouquet, IMG.peonies], featured: true, colors: ["#E8B7C0", "#F4DCE0", "#7A8F6A"], star: "Andromède", description: "Une brassée tendre de roses de jardin, d'œillets et de feuillages souples. Andromeda a la légèreté d'un matin de printemps dans un jardin anglais.", details: care },
    { name: "Orion", subtitle: "Grand bouquet sauvage, tons profonds", price: 8500, categoryId: "cat_bouquets", occasionIds: occ("amour", "anniversaire", "juste-parce-que"), images: [IMG.darkBouquet, IMG.darkRed], featured: true, isNew: true, colors: ["#5B1F3A", "#B5728C", "#2F3B2A"], star: "Orion", description: "Notre signature : un bouquet ample et libre, aux teintes de prune, de vieux rose et de feuillage sombre. Pour celles et ceux qui aiment les fleurs qui ont du caractère.", details: care },
    { name: "Polaris", subtitle: "Le petit bouquet du jour", price: 2500, categoryId: "cat_bouquets", occasionIds: occ("merci", "juste-parce-que"), images: [IMG.kraftBouquet], featured: true, colors: ["#F2C14E", "#F4EDE2", "#6E8B5C"], star: "L'étoile Polaire", description: "Composé chaque matin avec les arrivages du marché aux fleurs d'Hyères. Petit par la taille, grand par l'attention : l'étoile qui guide vers un sourire.", details: care },
    { name: "Véla", subtitle: "Bouquet champêtre, fleurs locales", price: 3000, categoryId: "cat_bouquets", occasionIds: occ("merci", "anniversaire"), images: [IMG.vaseColor], colors: ["#E2725B", "#F2D0A9", "#7C9A62"], star: "Les Voiles", description: "Des fleurs de saison cueillies dans le Var, montées en spirale avec un feuillage aérien. Un bouquet qui sent bon la Provence.", details: care },
    { name: "Halley", subtitle: "Tulipes et renoncules", price: 3000, categoryId: "cat_bouquets", occasionIds: occ("anniversaire", "naissance", "juste-parce-que"), images: [IMG.tulips], colors: ["#E86A92", "#FBE3EC", "#6A8F4E"], star: "La comète", description: "Comme la comète, il passe avec éclat : tulipes, renoncules et petites fleurs de printemps dans une harmonie fraîche et joyeuse.", details: care, seasonal: true },
    { name: "Antarès", subtitle: "Roses rouges, passion pure", price: 3000, categoryId: "cat_bouquets", occasionIds: occ("amour", "saint-valentin"), images: [IMG.redRoseDark, IMG.redRoses], featured: true, colors: ["#8E1B2C", "#3A0E16", "#2E3A26"], star: "Le cœur du Scorpion", description: "Des roses rouges profondes, presque velours, rehaussées d'un feuillage sombre. Antarès dit « je t'aime » sans détour.", details: care },
    { name: "Céti", subtitle: "Douceur blanche et verte", price: 3500, categoryId: "cat_bouquets", occasionIds: occ("naissance", "merci", "retablissement"), images: [IMG.whitePinkRoses], colors: ["#F6F1EA", "#E9D7D9", "#8FA58A"], star: "La Baleine", description: "Un camaïeu de blancs crémeux et de verts tendres. Céti apaise, félicite et accompagne les grands débuts.", details: care },
    { name: "Mira", subtitle: "Pivoines (en saison)", price: 3500, categoryId: "cat_bouquets", occasionIds: occ("amour", "fete-des-meres", "anniversaire"), images: [IMG.peony, IMG.peonies], colors: ["#E58BB0", "#F7D4E2", "#5E7D4D"], star: "La merveilleuse", description: "La pivoine dans tous ses états : boutons serrés et corolles ouvertes, pour un bouquet généreux qui s'épanouit de jour en jour.", details: care, seasonal: true },
    { name: "Rhéa", subtitle: "Roses pêche et feuillage argenté", price: 3500, categoryId: "cat_bouquets", occasionIds: occ("anniversaire", "merci", "fete-des-meres"), images: [IMG.peachRoses], colors: ["#F2A07B", "#F8D7C4", "#9DB0A0"], star: "Lune de Saturne", description: "Des roses couleur pêche et abricot, de l'eucalyptus argenté et quelques touches de blanc. Lumineux comme une fin d'après-midi au Brusc.", details: care },
    { name: "Charon", subtitle: "Bouquet bohème, tons secrets", price: 4000, categoryId: "cat_bouquets", occasionIds: occ("juste-parce-que", "anniversaire"), images: [IMG.pinkRosesDark], colors: ["#C46A7A", "#4A2A3A", "#7D8C6E"], star: "Lune de Pluton", description: "Un bouquet un peu mystérieux, entre roses anciennes et fleurs sauvages, pour celles et ceux qui préfèrent l'ombre douce à la pleine lumière.", details: care },
    { name: "Encelade", subtitle: "Hortensias bleus", price: 4000, categoryId: "cat_bouquets", occasionIds: occ("merci", "maison"), images: [IMG.hydrangea], colors: ["#3F5DB8", "#8DA2E0", "#3A4A2E"], star: "Lune de glace", description: "Des têtes d'hortensias aux reflets d'encre et de ciel, à peine accompagnées. Une pièce graphique qui sèche joliment.", details: care },
    { name: "Cor Caroli", subtitle: "Roses de jardin en dégradé", price: 4000, categoryId: "cat_bouquets", occasionIds: occ("amour", "anniversaire"), images: [IMG.pinkRoseDark], colors: ["#E7A1B0", "#F6D6DC", "#40503A"], star: "Le cœur de Charles", description: "Des roses de jardin parfumées, du rose thé au framboise, liées à la main avec du ruban de soie.", details: care },
    { name: "Umbriel", subtitle: "Dahlias et couleurs d'automne", price: 4000, categoryId: "cat_bouquets", occasionIds: occ("anniversaire", "juste-parce-que"), images: [IMG.pinkDahlia, IMG.dahliaDark], colors: ["#C4407C", "#E9A8C7", "#3E2A3A"], star: "Lune d'Uranus", description: "Le dahlia, roi de la fin d'été, en vedette avec des feuillages pourpres. Un bouquet sculptural et chaleureux.", details: care, seasonal: true, isNew: true },
    { name: "Pléioné", subtitle: "Bouquet tendre de naissance", price: 4000, categoryId: "cat_bouquets", occasionIds: occ("naissance", "merci"), images: [IMG.pastel], colors: ["#F4E1D9", "#F7EEE8", "#A8B79A"], star: "Mère des Pléiades", description: "Des fleurs poudrées, légères et délicatement parfumées pour souhaiter la bienvenue à un tout-petit.", details: care },
    { name: "Eridani", subtitle: "Le grand bouquet blanc", price: 4500, categoryId: "cat_bouquets", occasionIds: occ("merci", "deuil", "naissance"), images: [IMG.whiteKraftDark], colors: ["#F6F1EA", "#DCD6C8", "#6F7F66"], star: "Le fleuve Éridan", description: "Une rivière de blancs : roses, lisianthus et fleurs de saison, rehaussés de verdure. Élégant en toutes circonstances.", details: care },
    { name: "Cupidon", subtitle: "Roses & cœurs battants", price: 5000, categoryId: "cat_bouquets", occasionIds: occ("amour", "saint-valentin"), images: [IMG.roseBook, IMG.redRoses], colors: ["#B0172E", "#F2C9CF", "#1F2A1B"], star: "Éros", description: "Le bouquet des déclarations : roses rouges et roses tendres, une carte écrite à la main et tout ce que vous n'osez pas dire.", details: care },
    { name: "Lilii Borea", subtitle: "Lys et feuillages du nord", price: 5000, categoryId: "cat_bouquets", occasionIds: occ("anniversaire", "merci"), images: [IMG.magnolia], colors: ["#F6F1EA", "#E8D9C3", "#38452F"], star: "Aurore boréale", description: "De grandes fleurs blanches au parfum enveloppant, des feuillages graphiques : un bouquet lumineux et altier.", details: care },
    { name: "Félis", subtitle: "Bouquet généreux de la fleuriste", price: 5000, categoryId: "cat_bouquets", occasionIds: occ("juste-parce-que", "anniversaire", "merci"), images: [IMG.darkRed], featured: true, colors: ["#6E1F35", "#D46A6A", "#2F3B2A"], star: "Le Chat", description: "Laissez carte blanche à la fleuriste : les plus belles tiges du jour, assemblées selon l'inspiration et la saison.", details: care },
    { name: "Apophis", subtitle: "Bouquet graphique & rare", price: 5000, categoryId: "cat_bouquets", occasionIds: occ("juste-parce-que"), images: [IMG.dahliaDark], colors: ["#E9D3E6", "#B98BB8", "#1A1A12"], star: "L'astéroïde", description: "Pour les amateurs de curiosités : fleurs rares, textures inattendues et lignes sculpturales.", details: care, isNew: true },

    // ---------------- Compositions ----------------
    { name: "Altair", subtitle: "Centre de table retombant", price: 8700, categoryId: "cat_compositions", occasionIds: occ("maison", "anniversaire"), images: [IMG.weddingTable, IMG.vaseColor], featured: true, colors: ["#F2E3D5", "#D8A7A0", "#6C8060"], star: "L'Aigle", description: "Une composition basse et cascadante, pensée pour habiller une table de fête sans gêner les regards. Livrée sur support, prête à poser.", details: "Arrosez la mousse végétale tous les deux jours." },
    { name: "Hydra", subtitle: "Coupe fleurie d'exception", price: 9000, categoryId: "cat_compositions", occasionIds: occ("maison", "merci"), images: [IMG.roseGarden], colors: ["#D9708F", "#F5C6D4", "#4E6B3E"], star: "L'Hydre", description: "Une coupe débordante de fleurs de jardin, à poser sur un buffet ou une console. Généreuse sous tous les angles.", details: "Arrosez la mousse végétale tous les deux jours." },
    { name: "Libra", subtitle: "Composition en vase Médicis", price: 10000, categoryId: "cat_compositions", occasionIds: occ("maison", "anniversaire"), images: [IMG.roseVase], colors: ["#E3B6B9", "#2A2026", "#6F7A5F"], star: "La Balance", description: "Un équilibre parfait entre fleurs et feuillages dans un vase Médicis noir que vous conserverez.", details: care },
    { name: "Callisto", subtitle: "Grande composition d'entrée", price: 10000, categoryId: "cat_compositions", occasionIds: occ("maison"), images: [IMG.leavesDark, IMG.monsteraDark], colors: ["#2C3B26", "#7E9468", "#E9E1D2"], star: "Lune de Jupiter", description: "Une composition haute et architecturale pour les halls, boutiques et réceptions. Abonnement entreprise possible.", details: care, deliveryOnly: true },

    // ---------------- Plantes ----------------
    { name: "Monstera Deliciosa", subtitle: "Plante verte, pot en céramique", price: 4500, categoryId: "cat_plantes", occasionIds: occ("maison", "merci"), images: [IMG.monstera], colors: ["#2F5B2B", "#9DBF8A"], tiers: [1, 1.6, 2.4], description: "Ses grandes feuilles découpées apportent une note de jungle à n'importe quel intérieur. Facile à vivre, lumière indirecte.", details: "Arrosage hebdomadaire, laisser sécher la surface entre deux arrosages." },
    { name: "Ficus Ginseng", subtitle: "Bonsaï d'intérieur", price: 3900, categoryId: "cat_plantes", occasionIds: occ("maison", "merci", "anniversaire"), images: [IMG.bonsai], colors: ["#3E6B35", "#C9B79C"], tiers: null, description: "Un petit arbre aux racines sculpturales, symbole de longévité. Idéal pour un bureau lumineux.", details: "Brumiser le feuillage, arroser quand le terreau est sec en surface." },
    { name: "Bougainvillier en pot", subtitle: "Plante fleurie méditerranéenne", price: 5500, categoryId: "cat_plantes", occasionIds: occ("maison", "fete-des-meres"), images: [IMG.bougainvillea], colors: ["#7B2E8E", "#C783D6"], tiers: null, description: "Le violet éclatant des façades provençales, pour une terrasse ou un balcon ensoleillé.", details: "Plein soleil, arrosage régulier en été." },
    { name: "Topiaire de buis", subtitle: "Sculpture végétale", price: 6500, categoryId: "cat_plantes", occasionIds: occ("maison"), images: [IMG.topiary], colors: ["#24461F", "#6D8F55"], tiers: null, description: "Une boule parfaite, taillée à la main, dans un pot sombre. Un classique des jardins à l'anglaise.", details: "Extérieur, mi-ombre. Taille légère au printemps." },
    { name: "Gaïa", subtitle: "Composition de plantes en coupe", price: 4500, categoryId: "cat_plantes", occasionIds: occ("maison", "merci", "retablissement"), images: [IMG.houseplants], colors: ["#3F6B3A", "#B9C9A4"], tiers: [1, 1.5, 2], description: "Un petit jardin d'intérieur réunissant plusieurs plantes complémentaires dans une coupe en céramique.", details: "Arrosage modéré, lumière vive sans soleil direct." },

    // ---------------- Fleurs séchées ----------------
    { name: "Terebell", subtitle: "Bouquet de fleurs séchées", price: 3800, categoryId: "cat_sechees", occasionIds: occ("maison", "juste-parce-que"), images: [IMG.dried], colors: ["#D8B98E", "#B7835A", "#EFE3CF"], tiers: [1, 1.5, 2], description: "Graminées, lagurus, statice et fleurs immortelles dans des tons de blé et de miel. Il durera des mois.", details: "Tenir à l'abri de l'humidité et du soleil direct." },
    { name: "Atlas", subtitle: "Couronne séchée à suspendre", price: 3500, categoryId: "cat_sechees", occasionIds: occ("maison", "noel"), images: [IMG.lavender], colors: ["#8C6BB1", "#C8B5DE", "#C9B48A"], tiers: [1, 1.5, 2], description: "Une couronne de lavande de Provence, d'eucalyptus et de fleurs séchées, pour la porte ou le mur.", details: "Tenir à l'abri de l'humidité." },

    // ---------------- Deuil & hommage ----------------
    { name: "Atria", subtitle: "Bouquet de deuil", price: 4000, categoryId: "cat_deuil", occasionIds: occ("deuil"), images: [IMG.whiteRoseDark], colors: ["#F6F1EA", "#CFC8BC", "#556052"], star: "Le Triangle austral", description: "Un bouquet sobre et lumineux, à déposer au funérarium ou à offrir à la famille.", details: "Livraison possible au funérarium et au domicile de la famille.", tiers: [1, 1.5, 2.2] },
    { name: "Orion — gerbe", slug: "orion-gerbe", subtitle: "Gerbe de fleurs", price: 20000, categoryId: "cat_deuil", occasionIds: occ("deuil"), images: [IMG.whiteKraftDark], colors: ["#F6F1EA", "#E3D9CC", "#3E4A39"], star: "Orion", description: "Une gerbe allongée composée de fleurs blanches et de feuillages, avec ruban personnalisable.", details: "Ruban imprimé inclus — précisez votre texte dans le message.", tiers: [1, 1.3, 1.6], deliveryOnly: true },
    { name: "Norma", subtitle: "Croix de fleurs", price: 18000, categoryId: "cat_deuil", occasionIds: occ("deuil"), images: [IMG.magnolia], colors: ["#F6F1EA", "#D9CFC0"], star: "L'Équerre", description: "Une croix fleurie, symbole de foi et de mémoire, réalisée en fleurs fraîches de saison.", tiers: [1, 1.3, 1.6], deliveryOnly: true },
    { name: "Lacerta", subtitle: "Coussin de deuil", price: 24000, categoryId: "cat_deuil", occasionIds: occ("deuil"), images: [IMG.whitePinkRoses], colors: ["#F2E4E4", "#F6F1EA"], star: "Le Lézard", description: "Un coussin de roses serrées, pièce d'hommage traditionnelle, aux couleurs choisies avec vous.", tiers: [1, 1.25, 1.5], deliveryOnly: true },
    { name: "Cygnus", subtitle: "Couronne blanche", price: 25000, categoryId: "cat_deuil", occasionIds: occ("deuil"), images: [IMG.daisyBlack], colors: ["#FFFFFF", "#E8E1D6", "#3B4A35"], star: "Le Cygne", description: "La couronne, cercle de l'éternité : fleurs blanches et feuillages nobles, pour un dernier hommage tout en pureté.", tiers: [1, 1.25, 1.5], deliveryOnly: true },
    { name: "Sirius", subtitle: "Dessus de cercueil", price: 26000, categoryId: "cat_deuil", occasionIds: occ("deuil"), images: [IMG.whiteRoseDark], colors: ["#F6F1EA", "#C9C2B6"], star: "L'étoile la plus brillante", description: "Une composition longue et généreuse qui accompagne le défunt, réalisée sur mesure avec la famille.", tiers: [1, 1.25, 1.5], deliveryOnly: true },
    { name: "Crux", subtitle: "Couronne ouverte d'exception", price: 30000, categoryId: "cat_deuil", occasionIds: occ("deuil"), images: [IMG.magnolia], colors: ["#F6F1EA", "#D8CDBE", "#2F3B2A"], star: "La Croix du Sud", description: "Notre pièce d'hommage la plus ample, montée à la main avec des fleurs nobles et un ruban personnalisé.", tiers: [1, 1.2, 1.4], deliveryOnly: true },

    // ---------------- Fêtes & saisons ----------------
    { name: "Chrysanthème Toussaint", slug: "chrysantheme-toussaint", subtitle: "Pot de chrysanthèmes", price: 2600, categoryId: "cat_fetes", occasionIds: occ("toussaint", "deuil"), images: [IMG.chrysanthemum], featured: true, seasonal: true, colors: ["#F6F1EA", "#E9D9B8"], tiers: [1, 1.5, 2.3], description: "Des chrysanthèmes de producteurs locaux, en pot, pour fleurir les sépultures à la Toussaint. Retrait en boutique ou livraison.", details: "À arroser une fois par semaine. Supporte le plein air." },
    { name: "Bouquet de Noël", slug: "bouquet-de-noel", subtitle: "Sapin, baies & fleurs d'hiver", price: 3500, categoryId: "cat_fetes", occasionIds: occ("noel"), images: [IMG.darkRed], active: false, seasonal: true, colors: ["#7A1B1B", "#2E4A2B", "#C6A15B"], description: "Branches de sapin, baies rouges, fleurs d'hiver et une touche dorée pour illuminer les fêtes.", details: care },
    { name: "My Valentine", slug: "my-valentine", subtitle: "Édition Saint-Valentin", price: 6000, categoryId: "cat_fetes", occasionIds: occ("saint-valentin", "amour"), images: [IMG.redRoses], active: false, seasonal: true, colors: ["#9E1830", "#F1C3CB"], description: "Le bouquet de la Saint-Valentin, en édition limitée. Disponible du 1er au 14 février.", details: care },
    { name: "Bouquet Fête des Mères", slug: "bouquet-fete-des-meres", subtitle: "Pour elle, avec tendresse", price: 4000, categoryId: "cat_fetes", occasionIds: occ("fete-des-meres"), images: [IMG.peonies], active: false, seasonal: true, colors: ["#E58BB0", "#F7D4E2"], description: "Des fleurs de fin de printemps, pivoines en tête, pour dire merci à celle qui compte.", details: care },
  ] as P[]
).map(product);

export const seedAddons: Addon[] = [
  { id: "add_carte", name: "Carte illustrée « fougère »", description: "Carte gaufrée écrite à la main par la fleuriste.", price: 400, image: IMG.fern, active: true, sortOrder: 1 },
  { id: "add_vase_bulle", name: "Vase bulle en verre", description: "Verre soufflé, idéal pour les bouquets ronds.", price: 1600, image: IMG.roseVase, active: true, sortOrder: 2 },
  { id: "add_vase_medicis", name: "Vase Médicis noir", description: "Céramique mate, 25 cm.", price: 2200, image: IMG.roseVase, active: true, sortOrder: 3 },
  { id: "add_bougie", name: "Bougie « Jardin anglais »", description: "Cire végétale coulée en Provence, 40 h.", price: 2400, image: IMG.dried, active: true, sortOrder: 4 },
  { id: "add_chocolats", name: "Ballotin de chocolats", description: "Chocolatier artisanal varois, 12 pièces.", price: 1400, image: IMG.pastel, active: true, sortOrder: 5 },
];

export const seedPromos: PromoCode[] = [
  { id: "promo_bienvenue", code: "BIENVENUE10", type: "percent", value: 10, minSubtotal: 4000, uses: 0, active: true, maxUses: null, startsAt: null, endsAt: null, description: "10 % sur la première commande dès 40 €" },
  { id: "promo_livraison", code: "LIVRAISONOFFERTE", type: "free_delivery", value: 0, minSubtotal: 6000, uses: 0, active: true, maxUses: 200, startsAt: null, endsAt: null, description: "Livraison offerte dès 60 €" },
];

export const seedReviews: Review[] = [
  { author: "Auréline", text: "Violaine n'a pas fait que fleurir notre événement ; elle l'a sublimé.", source: "Mariages.net" },
  { author: "Aurélien", text: "Une vraie artiste florale ! Les bouquets de la mariée et les boutonnières étaient magnifiques, tout comme la décoration de l'église puis de nos tables.", source: "Mariages.net" },
  { author: "Émilie", text: "Tout était sublime, un sans-faute du bouquet au dernier pétale.", source: "Mariages.net" },
  { author: "Cuny", text: "Vous pouvez y aller les yeux fermés, confiance absolue.", source: "Mariages.net" },
  { author: "Maïté", text: "Nous avons même pu être livrés à domicile le matin du mariage.", source: "Mariages.net" },
  { author: "Pauline", text: "Un très bon suivi, à l'écoute de nos attentes.", source: "Mariages.net" },
  { author: "Camille", text: "Fleuriste dynamique et souriante, nous avons eu exactement ce que nous voulions.", source: "Mariages.net" },
  { author: "Marie-Lou", text: "Elles ont été aux petits soins et de très bons conseils, merci encore à vous !", source: "Mariages.net" },
  { author: "Sébastien", text: "Elle a su nous conseiller et nous accompagner dans ce moment très important.", source: "Mariages.net" },
  { author: "Justine", text: "Mes désirs ont tout de suite été cernés.", source: "Mariages.net" },
  { author: "Claire", text: "Nous ne pouvons que recommander chaleureusement le travail de Violaine !", source: "Mariages.net" },
].map((r, i) => ({ id: `rev_${i + 1}`, rating: 5, date: "2025-07-01", active: true, featured: i < 6, ...r }));

export const seedFaqs: Faq[] = [
  ["Livraison", "Où livrez-vous ?", "Nous livrons nous-mêmes, en voiture, à Six-Fours-les-Plages, Sanary-sur-Mer, La Seyne-sur-Mer, Ollioules et alentours (Bandol, Toulon, Saint-Mandrier). Indiquez votre code postal au panier : les frais s'affichent instantanément."],
  ["Livraison", "Puis-je être livré le jour même ?", "Oui, pour toute commande passée avant 14 h (hors dimanche après-midi et lundi), sous réserve des créneaux disponibles. Pour une date précise, commandez jusqu'à deux mois à l'avance."],
  ["Commande", "Que se passe-t-il si une fleur n'est pas disponible ?", "Nous travaillons à plus de 80 % avec des fleurs locales et de saison. Si une variété manque, la fleuriste la remplace par une fleur de même teinte et de même valeur, en respectant l'esprit du bouquet."],
  ["Commande", "Puis-je ajouter un message ?", "Bien sûr. Votre message est écrit à la main sur une carte, gratuitement. Vous pouvez aussi rester anonyme."],
  ["Retrait", "Comment fonctionnent le retrait et le Drive ?", "Le retrait en boutique est gratuit. Avec le Drive, prévenez-nous à votre arrivée devant la boutique (830 av. Maréchal de Lattre de Tassigny) : nous vous apportons votre commande à la voiture."],
  ["Paiement", "Le paiement est-il sécurisé ?", "Oui. Le paiement est traité par Stripe (carte bancaire, Apple Pay, Google Pay). Nous n'avons jamais accès à vos données bancaires."],
  ["Deuil", "Livrez-vous les funérariums et les églises ?", "Oui, nous livrons funérariums, églises et cimetières de la région. Précisez l'heure de la cérémonie et le nom du défunt dans les instructions de livraison ; nous pouvons imprimer un ruban personnalisé."],
  ["Mariage", "Combien de temps à l'avance réserver pour un mariage ?", "Le plus tôt possible : nous n'acceptons qu'un nombre limité de mariages par week-end. Un acompte de 50 % est demandé à la signature du devis, le solde la semaine du mariage. Déplacement jusqu'à 80 km."],
  ["Entretien", "Comment faire durer mon bouquet ?", "Recoupez les tiges en biseau, changez l'eau tous les deux jours, retirez les feuilles immergées et éloignez le vase des fruits et des sources de chaleur."],
].map(([category, question, answer], i) => ({ id: `faq_${i + 1}`, category, question, answer, sortOrder: i + 1, active: true }));

export const seedGallery: GalleryItem[] = (
  [
    [IMG.brideDark, "Bouquet de mariée, tons poudrés", "mariage"],
    [IMG.weddingAisle, "Allée de cérémonie fleurie", "mariage"],
    [IMG.weddingTable, "Centres de table retombants", "mariage"],
    [IMG.weddingHands, "Le jour J", "mariage"],
    [IMG.weddingChairs, "Chaises des mariés", "mariage"],
    [IMG.shopFront, "La boutique, avenue de Lattre de Tassigny", "boutique"],
    [IMG.darkBouquet, "Bouquet de saison", "atelier"],
    [IMG.handsFern, "Le geste", "atelier"],
    [IMG.whiteRoseDark, "Hommage tout en blanc", "deuil"],
    [IMG.magnolia, "Pureté", "deuil"],
    [IMG.roseWall, "Mur de roses pour un événement", "evenement"],
    [IMG.dahliaDark, "Dahlia Café au lait", "atelier"],
  ] as [string, string, GalleryItem["category"]][]
).map(([image, caption, category], i) => ({ id: `gal_${i + 1}`, image, caption, category, sortOrder: i + 1, active: true }));

const hours = (from1: string, to1: string, from2?: string, to2?: string) =>
  from2 ? [{ from: from1, to: to1 }, { from: from2, to: to2! }] : [{ from: from1, to: to1 }];

export const seedSettings: Settings = {
  shopName: "Empreinte de Violettes",
  tagline: "Artisane fleuriste à Six-Fours-les-Plages",
  legalName: "Empreinte de Violettes",
  siret: "912 788 932 00016",
  phone: "04 94 32 87 32",
  email: "contact@empreintedeviolettes.fr",
  address: "830 avenue Maréchal de Lattre de Tassigny",
  postcode: "83140",
  city: "Six-Fours-les-Plages",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Empreinte+de+Violettes+830+Av.+Mar%C3%A9chal+de+Lattre+de+Tassigny+83140+Six-Fours-les-Plages",
  lat: 43.0988,
  lng: 5.8395,
  instagram: "https://www.instagram.com/empreintedeviolettes/",
  facebook: "https://www.facebook.com/empreintedeviolettes",
  hours: [
    { day: 1, closed: true, ranges: [] },
    { day: 2, closed: false, ranges: hours("09:00", "12:30", "15:00", "19:30") },
    { day: 3, closed: false, ranges: hours("09:00", "12:30", "15:00", "19:30") },
    { day: 4, closed: false, ranges: hours("09:00", "12:30", "15:00", "19:30") },
    { day: 5, closed: false, ranges: hours("09:00", "12:30", "15:00", "19:30") },
    { day: 6, closed: false, ranges: hours("09:00", "12:30", "15:00", "19:30") },
    { day: 0, closed: false, ranges: hours("09:00", "12:30") },
  ],
  closures: [],
  announcement: { active: true, text: "Toussaint : chrysanthèmes et compositions d'hommage à commander dès maintenant", link: "/boutique?categorie=fetes-et-saisons" },
  intro: { enabled: true, oncePerSession: true },
  maintenance: { enabled: false, message: "La boutique en ligne fait peau neuve. Nous revenons très vite !" },
  seo: {
    title: "Empreinte de Violettes — Artisane fleuriste à Six-Fours-les-Plages",
    description: "Bouquets façon jardin à l'anglaise, fleurs locales, mariages et deuil. Livraison à Six-Fours, Sanary, La Seyne et alentours. Retrait gratuit et Drive.",
  },
  notifyEmail: "contact@empreintedeviolettes.fr",
  allowPayInStore: true,
  googleRating: 4.8,
  googleReviews: 193,
};

export const seedDelivery: DeliverySettings = {
  deliveryEnabled: true,
  pickupEnabled: true,
  driveEnabled: true,
  zones: [
    { id: "zone_sixfours", name: "Six-Fours-les-Plages", postcodes: ["83140"], cities: ["Six-Fours-les-Plages", "Le Brusc", "Reynier"], fee: 800, minOrder: 2500, freeFrom: 9000, active: true },
    { id: "zone_proche", name: "Sanary · La Seyne · Ollioules", postcodes: ["83110", "83500", "83190"], cities: ["Sanary-sur-Mer", "La Seyne-sur-Mer", "Ollioules"], fee: 1200, minOrder: 3000, freeFrom: 12000, active: true },
    { id: "zone_ouest", name: "Bandol · Toulon · Saint-Mandrier", postcodes: ["83150", "83000", "83100", "83200", "83430", "83330"], cities: ["Bandol", "Toulon", "Saint-Mandrier-sur-Mer", "Le Beausset", "Évenos"], fee: 1800, minOrder: 4000, freeFrom: null, active: true },
  ],
  slots: [
    { id: "slot_matin", label: "Matin · 9 h – 12 h 30", from: "09:00", to: "12:30", days: [0, 2, 3, 4, 5, 6], modes: ["delivery", "pickup", "drive"], capacity: 12 },
    { id: "slot_aprem", label: "Après-midi · 15 h – 19 h", from: "15:00", to: "19:00", days: [2, 3, 4, 5, 6], modes: ["delivery", "pickup", "drive"], capacity: 12 },
  ],
  leadTimeHours: 3,
  sameDayCutoff: "14:00",
  maxDaysAhead: 60,
  closedDays: [1],
  blackoutDates: ["2026-12-25", "2027-01-01"],
  pickupNote: "Retrait gratuit en boutique, 830 av. Maréchal de Lattre de Tassigny.",
  driveNote: "Garez-vous devant la boutique et appelez le 04 94 32 87 32 : nous vous apportons votre commande.",
};

export const seedContent: Content = {
  hero: {
    eyebrow: "Maison fondée en avril 2022",
    titleLine1: "L'art floral",
    titleLine2: "à l'anglaise",
    subtitle:
      "Bouquets sauvages, fleurs locales et plantes rares, composés à la main dans notre cabinet de curiosités botaniques. Livrés chez vous ou à retirer en boutique.",
    ctaLabel: "Entrer dans la boutique",
    images: [IMG.dahliaDark],
    videoUrl: "",
  },
  marquee: [
    "Fleurs locales à plus de 80 %",
    "Livraison Six-Fours · Sanary · La Seyne",
    "Retrait gratuit & Drive",
    "Mariages sur mesure",
    "Formée auprès d'un Meilleur Ouvrier de France",
    "Partenaire Interflora",
  ],
  manifesto: {
    eyebrow: "Le geste",
    text:
      "Ici, chaque bouquet laisse une empreinte. Des fleurs cueillies au plus près, du marché aux fleurs d'Hyères aux producteurs du Var, assemblées avec la liberté d'un jardin anglais et la rigueur apprise auprès d'un Meilleur Ouvrier de France. Pas de fleurs figées : des tiges qui bougent, des feuillages qui respirent, des couleurs qui racontent une saison.",
    signature: "— L'artisane fleuriste",
    image: IMG.handsFern,
  },
  stats: [
    { value: "4,8/5", label: "193 avis Google" },
    { value: "80 %", label: "de fleurs locales" },
    { value: "2022", label: "année de fondation" },
    { value: "7j/7", label: "commande en ligne" },
  ],
  seasonal: {
    active: true,
    eyebrow: "Toussaint · 1er novembre",
    title: "Fleurir le souvenir",
    text: "Chrysanthèmes de producteurs locaux, compositions et coussins d'hommage : commandez dès maintenant, livraison au cimetière ou retrait en boutique.",
    targetDate: "2026-11-01T09:00:00+01:00",
    ctaLabel: "Voir la sélection Toussaint",
    ctaLink: "/boutique?categorie=fetes-et-saisons",
    image: IMG.chrysanthemum,
  },
  about: {
    title: "Une passion qui laisse son empreinte",
    intro:
      "La boutique Empreinte de Violettes est née en avril 2022 d'une véritable passion pour l'univers floral et le monde végétal.",
    paragraphs: [
      "Après un apprentissage auprès de plusieurs artisans, dont un Meilleur Ouvrier de France, notre fleuriste a obtenu son CAP puis son BP de fleuriste, avant d'ouvrir sa propre maison au cœur de Six-Fours-les-Plages.",
      "Son style : le jardin à l'anglaise. Des compositions naturelles, rustiques et élégantes, où chaque fleur garde son mouvement. Dans la boutique, l'ambiance est celle d'un cabinet de curiosités : plantes rares, fleurs séchées, objets chinés et feuillages sombres.",
      "Une boutique éco-responsable, enfin : plus de 80 % de nos fleurs sont locales ou françaises, achetées notamment au marché aux fleurs d'Hyères, pour soutenir l'emploi de nos producteurs et réduire l'empreinte de chaque bouquet.",
    ],
    image: IMG.shopFront,
    values: [
      { title: "Local d'abord", text: "Plus de 80 % de fleurs du Var et de France, au rythme des saisons." },
      { title: "Fait main", text: "Chaque création est unique, montée à la main dans notre atelier." },
      { title: "Sur mesure", text: "Un conseil personnalisé pour chaque occasion : maison, mariage, entreprise, hommage." },
      { title: "Responsable", text: "Peu d'emballage plastique, papier kraft et rubans réutilisables." },
    ],
  },
  wedding: {
    title: "Votre mariage, en fleurs",
    intro:
      "Bouquet de la mariée, boutonnières, décoration de cérémonie et de réception, voiture, accessoires de cheveux : nous imaginons ensemble un univers floral qui vous ressemble, avec des fleurs fraîches et de saison.",
    steps: [
      { title: "La rencontre", text: "Un premier échange pour comprendre vos envies, votre lieu, votre palette et votre budget." },
      { title: "Le devis", text: "Une proposition détaillée et des planches d'inspiration. Acompte de 50 % à la signature." },
      { title: "L'essai", text: "Nous ajustons ensemble le bouquet de mariée et les pièces maîtresses." },
      { title: "Le jour J", text: "Livraison et installation sur place, jusqu'à 80 km. Solde la semaine du mariage." },
    ],
    image: IMG.brideDark,
    priceNote: "Nous acceptons un nombre limité de mariages par week-end : réservez tôt.",
  },
  funeral: {
    title: "Rendre hommage",
    intro:
      "Dans les moments difficiles, nous vous accompagnons avec douceur. Bouquets, gerbes, couronnes et dessus de cercueil sont livrés aux funérariums, églises et cimetières de la région, avec ruban personnalisé sur demande.",
    image: IMG.whiteRoseDark,
  },
  legal: {
    mentions:
      "Éditeur du site : Empreinte de Violettes — 830 avenue Maréchal de Lattre de Tassigny, 83140 Six-Fours-les-Plages. Téléphone : 04 94 32 87 32. SIRET : 912 788 932 00016.\n\nHébergement : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.\n\nPhotographies : créations de la Maison et banque d'images Unsplash (licence Unsplash).\n\nToute reproduction, même partielle, des contenus du site est interdite sans autorisation.",
    cgv:
      "1. Objet — Les présentes conditions régissent les ventes de fleurs, plantes et accessoires réalisées sur ce site.\n\n2. Produits — Les fleurs étant des produits vivants et saisonniers, la fleuriste peut remplacer une variété indisponible par une variété de même valeur et d'harmonie équivalente. Les photographies sont non contractuelles.\n\n3. Prix — Les prix sont indiqués en euros TTC. Les frais de livraison sont précisés avant le paiement.\n\n4. Commande et paiement — La commande est validée après paiement sécurisé par Stripe, ou au retrait lorsque le paiement en boutique est proposé.\n\n5. Livraison — Les livraisons sont effectuées dans la zone indiquée sur le site, aux date et créneau choisis. En cas d'absence du destinataire, la commande est déposée chez un voisin ou un nouveau passage est convenu par téléphone.\n\n6. Droit de rétractation — Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux biens susceptibles de se détériorer rapidement, comme les fleurs coupées.\n\n7. Réclamations — Toute réclamation doit être formulée sous 24 h, photo à l'appui, à contact@empreintedeviolettes.fr.\n\n8. Médiation — En cas de litige, vous pouvez recourir gratuitement à un médiateur de la consommation.",
    privacy:
      "Les données collectées (nom, coordonnées, adresse de livraison, message) servent uniquement au traitement de vos commandes et demandes. Elles sont conservées 3 ans et ne sont jamais revendues. Les paiements sont traités par Stripe, qui ne nous transmet aucune donnée bancaire. Vous pouvez exercer vos droits d'accès, de rectification et de suppression en écrivant à contact@empreintedeviolettes.fr. Vous pouvez également vous inscrire sur la liste d'opposition au démarchage téléphonique Bloctel.",
  },
};

export const seedAtelier: AtelierSettings = {
  enabled: true,
  basePrice: 800,
  minStems: 5,
  maxStems: 30,
  flowers: [
    ["Rose de jardin", "#E7A1B0", 450, "fleur"],
    ["Rose prune", "#6E1F35", 450, "fleur"],
    ["Pivoine", "#E58BB0", 650, "fleur"],
    ["Renoncule", "#F2A07B", 350, "fleur"],
    ["Anémone", "#F6F1EA", 300, "fleur"],
    ["Dahlia", "#C4407C", 400, "fleur"],
    ["Lisianthus", "#B9A2CF", 350, "fleur"],
    ["Tulipe", "#E86A92", 250, "fleur"],
    ["Muflier", "#F2D0A9", 300, "fleur"],
    ["Matricaire", "#FFFFFF", 200, "fleur"],
    ["Lavande de Provence", "#8C6BB1", 150, "fleur"],
    ["Eucalyptus", "#9DB0A0", 200, "feuillage"],
    ["Fougère", "#3E6B35", 150, "feuillage"],
    ["Olivier", "#8A9A7B", 200, "feuillage"],
    ["Graminées", "#D8B98E", 150, "feuillage"],
  ].map(([name, color, price, kind], i) => ({ id: `flw_${i + 1}`, name: name as string, color: color as string, price: price as number, kind: kind as "fleur" | "feuillage", active: true })),
  wrappings: [
    { id: "wrap_kraft", name: "Papier kraft & raphia", price: 0, color: "#C9A27A" },
    { id: "wrap_soie", name: "Papier de soie violine", price: 300, color: "#6E4F8C" },
    { id: "wrap_noir", name: "Papier noir & ruban doré", price: 500, color: "#141016" },
    { id: "wrap_vase", name: "Vase bulle en verre", price: 1600, color: "#DCE6E8" },
  ],
};
