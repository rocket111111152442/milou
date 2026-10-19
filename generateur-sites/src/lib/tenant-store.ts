import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { getFile, getJSON, listEntries, putFile, putJSON, wipePrefix } from "./store";
import type { TenantConfig } from "./tenant";

const KEY = (slug: string) => `t/${slug}/site.json`;

/** Site d'un commerçant, mis en cache et invalidé à chaque enregistrement. */
export function getTenant(slug: string): Promise<TenantConfig | null> {
  return unstable_cache(() => getJSON<TenantConfig>(KEY(slug)), ["tenant", slug], { tags: [`tenant:${slug}`], revalidate: 300 })();
}

export const getTenantFresh = (slug: string) => getJSON<TenantConfig>(KEY(slug));

export async function saveTenant(t: TenantConfig) {
  await putJSON(KEY(t.slug), t);
  updateTag(`tenant:${t.slug}`);
}

export async function listTenants(): Promise<TenantConfig[]> {
  const entries = (await listEntries("t/")).filter((e) => e.pathname.endsWith("/site.json"));
  const all = await Promise.all(entries.map((e) => getJSON<TenantConfig>(e.pathname)));
  return all.filter((t): t is TenantConfig => t !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteTenant(slug: string) {
  const n = await wipePrefix(`t/${slug}/`);
  updateTag(`tenant:${slug}`);
  updateTag(`settings:${slug}`);
  return n;
}

export async function savePhoto(slug: string, name: string, body: Buffer, contentType: string) {
  await putFile(`t/${slug}/photos/${name}`, body, contentType);
}

export const readPhoto = (slug: string, name: string) => getFile(`t/${slug}/photos/${name}`);
