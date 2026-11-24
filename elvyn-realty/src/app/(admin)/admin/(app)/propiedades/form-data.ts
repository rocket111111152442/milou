import "server-only";
import { getFacets } from "@/lib/catalog/service";

/** Property types and cities already used in the catalogue (for the form's choices). */
export async function formChoices() {
  const facets = await getFacets().catch(() => null);
  return {
    categories: (facets?.categories ?? []).map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name, "es")),
    cities: (facets?.cities ?? []).map((c) => c.name),
  };
}
