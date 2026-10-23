import "server-only";
import { cache } from "react";
import { getDoc, list } from "./db";

const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

export const getSettings = cache(() => getDoc("settings"));
export const getContent = cache(() => getDoc("content"));
export const getDelivery = cache(() => getDoc("delivery"));
export const getAtelier = cache(() => getDoc("atelier"));

export const getCategories = cache(async () => (await list("categories")).filter((c) => c.active).sort(bySort));
export const getOccasions = cache(async () => (await list("occasions")).filter((c) => c.active).sort(bySort));
export const getAddons = cache(async () => (await list("addons")).filter((c) => c.active).sort(bySort));
export const getProducts = cache(async () => (await list("products")).filter((p) => p.active).sort(bySort));
export const getReviews = cache(async () => (await list("reviews")).filter((r) => r.active).sort((a, b) => Number(b.featured) - Number(a.featured)));
export const getFaqs = cache(async () => (await list("faqs")).filter((f) => f.active).sort(bySort));
export const getGallery = cache(async () => (await list("gallery")).filter((g) => g.active).sort(bySort));

export async function getProduct(slug: string) {
  const products = await getProducts();
  return products.find((p) => p.slug === slug) || null;
}
