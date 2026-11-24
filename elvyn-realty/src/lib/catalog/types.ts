export type Currency = string; // as received (USD, DOP, ...)
export interface Money { amount: number; currency: Currency }
export type Operation = "sale" | "rent" | "rental";

export interface AgentContact {
  name: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  position: string | null;
  companyId: number | null;
}

export interface ListingSummary {
  uid: string;
  ref: string | null; // public listing code (cid)
  slug: string;
  title: string;
  shortDescription: string | null;
  category: { id: number | null; name: string | null; nameEn: string | null } | null;
  operations: Operation[];
  isProject: boolean;
  condition: { code: number | null; label: string | null };
  price: { sale: Money | null; rent: Money | null; rental: Money | null; projectFrom: Money | null; projectTo: Money | null };
  usd: { sale: number | null; rent: number | null; rental: number | null };
  location: { province: string | null; city: string | null; sector: string | null };
  bedrooms: number | null;
  bathrooms: number | null;
  halfBathrooms: number | null;
  parking: number | null;
  area: { value: number; unit: string } | null;
  landArea: { value: number; unit: string } | null;
  image: string | null;
  exclusive: boolean | null; // only when AlterEstate provides the flag
  featured: boolean | null; // only when AlterEstate provides the flag
  furnished: boolean | null;
  createdAt: string | null;
  agencyOwned: boolean | null; // null = unknown (no agent data)
}

export interface ProjectUnit {
  ref: string | null;
  model: string | null;
  price: Money | null;
  area: { value: number; unit: string } | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  status: "available" | "reserved" | "sold" | "unavailable" | "unknown";
}

export interface ListingDetail extends ListingSummary {
  descriptionHtml: string;
  descriptionText: string;
  amenities: string[];
  images: string[];
  prices: {
    furnishedRent: Money | null;
    furnishedSale: Money | null;
    maintenance: Money | null;
  };
  terraceArea: { value: number; unit: string } | null;
  floorLevel: number | null;
  totalFloors: number | null;
  yearBuilt: string | null;
  deliveryDate: string | null;
  hideLocation: boolean;
  coordinates: { lat: number; lng: number } | null;
  videoUrl: string | null;
  virtualTourUrl: string | null;
  agents: AgentContact[];
  units: ProjectUnit[];
  related: ListingSummary[];
}

export type SortKey = "recent" | "price_asc" | "price_desc" | "bedrooms_desc";

export interface SearchFilters {
  operation: "sale" | "rent" | null;
  categories: number[];
  city: string | null; // city name (AlterEstate `city_name`)
  q: string | null; // free text: sector, neighbourhood, listing code
  currency: "USD" | "DOP";
  priceMin: number | null;
  priceMax: number | null;
  bedroomsMin: number | null;
  bathroomsMin: number | null;
  parkingMin: number | null;
  condition: "ready" | "construction" | null;
  sort: SortKey;
  page: number;
}

export interface SearchResult {
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  results: ListingSummary[];
}

export interface Facets {
  cities: { name: string; count: number }[];
  categories: { id: number; name: string; nameEn: string | null; count: number }[];
  total: number;
}
