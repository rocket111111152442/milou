// Modèle de données de la boutique. Tous les montants sont en centimes d'euro.

export type ID = string;

export interface ProductVariant {
  id: ID;
  name: string; // ex. « Classique », « Généreux », « Somptueux »
  price: number;
  description?: string;
}

export interface Product {
  id: ID;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  details?: string; // composition, conseils d'entretien
  categoryId: ID;
  occasionIds: ID[];
  price: number; // prix « à partir de » (variante la moins chère si variantes)
  compareAtPrice?: number | null;
  variants: ProductVariant[];
  images: string[];
  stock: number | null; // null = illimité
  active: boolean;
  featured: boolean;
  isNew: boolean;
  seasonal: boolean;
  deliveryOnly?: boolean;
  pickupOnly?: boolean;
  colors: string[]; // teintes dominantes (hex) pour l'affichage
  tags: string[];
  star?: string; // constellation / étoile associée
  plate?: string; // gravure de l'herbier (sinon déduite du nom)
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: ID;
  slug: string;
  name: string;
  description: string;
  image: string;
  plate?: string;
  active: boolean;
  showInMenu: boolean;
  sortOrder: number;
}

export interface Occasion {
  id: ID;
  slug: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

export interface Addon {
  id: ID;
  name: string;
  description: string;
  price: number;
  image: string;
  active: boolean;
  sortOrder: number;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "picked_up"
  | "cancelled"
  | "refunded";

export type FulfillmentMode = "delivery" | "pickup" | "drive";

export interface OrderItem {
  productId: ID | null; // null pour une création de l'atelier
  slug?: string;
  name: string;
  variantId?: ID;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  image?: string;
  addons: { id: ID; name: string; price: number }[];
  custom?: {
    stems: { flowerId: ID; name: string; quantity: number; unitPrice: number }[];
    wrappingId?: ID;
    wrappingName?: string;
    note?: string;
  };
  lineTotal: number;
}

export interface Order {
  id: ID;
  number: string;
  accessToken: string; // lien privé de suivi / confirmation
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid" | "refunded" | "demo" | "in_store";
  paymentMethod: "stripe" | "in_store" | "demo";
  customer: { firstName: string; lastName: string; email: string; phone: string };
  mode: FulfillmentMode;
  recipient?: {
    name: string;
    phone: string;
    company?: string;
    address: string;
    address2?: string;
    postcode: string;
    city: string;
    instructions?: string;
  };
  zoneId?: ID;
  zoneName?: string;
  date: string; // AAAA-MM-JJ
  slotId: ID;
  slotLabel: string;
  items: OrderItem[];
  cardMessage?: string;
  cardSignature?: string;
  anonymous?: boolean;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  promoCode?: string;
  total: number;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  adminNotes?: string;
  history: { at: string; status: OrderStatus | "note"; label: string }[];
  stockApplied?: boolean;
}

export interface PromoCode {
  id: ID;
  code: string;
  type: "percent" | "fixed" | "free_delivery";
  value: number; // % ou centimes
  minSubtotal: number;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses?: number | null;
  uses: number;
  active: boolean;
  description?: string;
}

export type MessageType = "contact" | "mariage" | "evenement" | "deuil" | "entreprise";

export interface Message {
  id: ID;
  type: MessageType;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  eventDate?: string;
  budget?: string;
  guests?: string;
  venue?: string;
  status: "new" | "read" | "replied" | "archived";
  createdAt: string;
}

export interface Review {
  id: ID;
  author: string;
  text: string;
  rating: number;
  source: string;
  date: string;
  active: boolean;
  featured: boolean;
}

export interface Faq {
  id: ID;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  active: boolean;
}

export interface GalleryItem {
  id: ID;
  image: string;
  caption: string;
  category: "mariage" | "deuil" | "boutique" | "evenement" | "atelier";
  sortOrder: number;
  active: boolean;
}

export interface Subscriber {
  id: ID;
  email: string;
  createdAt: string;
}

// ---------- Documents uniques ----------

export interface DayHours {
  day: number; // 0 = dimanche … 6 = samedi
  closed: boolean;
  ranges: { from: string; to: string }[];
}

export interface Settings {
  shopName: string;
  tagline: string;
  legalName: string;
  siret: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  city: string;
  mapsUrl: string;
  lat: number;
  lng: number;
  instagram: string;
  facebook: string;
  hours: DayHours[];
  closures: { id: ID; from: string; to: string; label: string }[];
  announcement: { active: boolean; text: string; link: string };
  intro: { enabled: boolean; oncePerSession: boolean };
  maintenance: { enabled: boolean; message: string };
  seo: { title: string; description: string };
  notifyEmail: string;
  allowPayInStore: boolean;
  googleRating: number;
  googleReviews: number;
}

export interface DeliveryZone {
  id: ID;
  name: string;
  postcodes: string[];
  cities: string[];
  fee: number;
  minOrder: number;
  freeFrom: number | null;
  active: boolean;
}

export interface TimeSlot {
  id: ID;
  label: string;
  from: string; // HH:MM
  to: string;
  days: number[]; // jours actifs (0-6)
  modes: FulfillmentMode[];
  capacity: number | null; // commandes max par créneau et par jour
}

export interface DeliverySettings {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  driveEnabled: boolean;
  zones: DeliveryZone[];
  slots: TimeSlot[];
  leadTimeHours: number; // délai minimum de préparation
  sameDayCutoff: string; // HH:MM — au-delà, pas de livraison le jour même
  maxDaysAhead: number;
  closedDays: number[];
  blackoutDates: string[];
  pickupNote: string;
  driveNote: string;
}

export interface Content {
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    ctaLabel: string;
    images: string[];
    videoUrl: string;
  };
  marquee: string[];
  manifesto: { eyebrow: string; text: string; signature: string; image: string };
  stats: { value: string; label: string }[];
  seasonal: {
    active: boolean;
    eyebrow: string;
    title: string;
    text: string;
    targetDate: string;
    ctaLabel: string;
    ctaLink: string;
    image: string;
  };
  about: { title: string; intro: string; paragraphs: string[]; image: string; values: { title: string; text: string }[] };
  wedding: { title: string; intro: string; steps: { title: string; text: string }[]; image: string; priceNote: string };
  funeral: { title: string; intro: string; image: string };
  legal: { mentions: string; cgv: string; privacy: string };
}

export interface AtelierFlower {
  id: ID;
  name: string;
  color: string;
  price: number;
  active: boolean;
  kind: "fleur" | "feuillage";
  plate?: string;
}

export interface AtelierSettings {
  enabled: boolean;
  basePrice: number; // main d'œuvre / composition
  minStems: number;
  maxStems: number;
  flowers: AtelierFlower[];
  wrappings: { id: ID; name: string; price: number; color: string }[];
}

export type CollectionName =
  | "products"
  | "categories"
  | "occasions"
  | "addons"
  | "orders"
  | "promos"
  | "messages"
  | "reviews"
  | "faqs"
  | "gallery"
  | "subscribers";

export type DocName = "settings" | "delivery" | "content" | "atelier";

export interface DocMap {
  settings: Settings;
  delivery: DeliverySettings;
  content: Content;
  atelier: AtelierSettings;
}

export interface CollectionMap {
  products: Product;
  categories: Category;
  occasions: Occasion;
  addons: Addon;
  orders: Order;
  promos: PromoCode;
  messages: Message;
  reviews: Review;
  faqs: Faq;
  gallery: GalleryItem;
  subscribers: Subscriber;
}

// ---------- Panier (client) ----------

export interface CartLine {
  key: string;
  productId: ID | null;
  slug?: string;
  name: string;
  image?: string;
  variantId?: ID;
  variantName?: string;
  unitPrice: number; // indicatif — recalculé côté serveur
  quantity: number;
  addonIds: ID[];
  addonNames?: string[];
  custom?: {
    stems: { flowerId: ID; quantity: number }[];
    wrappingId?: ID;
    note?: string;
    summary?: string;
  };
}
