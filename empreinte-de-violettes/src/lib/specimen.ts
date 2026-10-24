import type { SpecimenProduct } from "@/components/herbier/Specimen";
import { plateFor } from "./plates";
import type { Category, Product } from "./types";

/** Prépare les créations pour les cartes « planche d'herbier » (numérotées dans l'ordre du catalogue). */
export function toSpecimens(products: Product[], categories: Pick<Category, "id" | "name">[]): (SpecimenProduct & { categoryId: string; occasionIds: string[]; featured: boolean; description: string; sortOrder: number; tags: string[] })[] {
  return products.map((p, i) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    variants: p.variants.map((v) => ({ price: v.price })),
    images: p.images.slice(0, 2),
    isNew: p.isNew,
    seasonal: p.seasonal,
    stock: p.stock,
    plate: plateFor(p),
    category: categories.find((c) => c.id === p.categoryId)?.name,
    number: i + 1,
    categoryId: p.categoryId,
    occasionIds: p.occasionIds,
    featured: p.featured,
    description: p.description,
    sortOrder: p.sortOrder,
    tags: p.tags,
  }));
}
