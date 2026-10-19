import "server-only";
import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import type { Product } from "./catalog";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "./settings";
import { getJSON, putJSON, storageEnabled } from "./store";

const PATH = (slug: string) => `t/${slug}/reglages.json`;

async function readRaw(slug: string) {
  if (!storageEnabled()) return null;
  return getJSON<unknown>(PATH(slug));
}

/** Réglages d'un site, mis en cache et invalidés à chaque enregistrement depuis son /admin. */
export async function getSettings(slug: string, base: Product[]): Promise<Settings> {
  const raw = await unstable_cache(() => readRaw(slug), ["settings", slug], { tags: [`settings:${slug}`], revalidate: 300 })();
  return raw ? normalizeSettings(raw, base) : DEFAULT_SETTINGS;
}

/** Lecture directe, sans cache (pour modifier puis réenregistrer). */
export async function getSettingsFresh(slug: string, base: Product[]): Promise<Settings> {
  const raw = await readRaw(slug);
  return raw ? normalizeSettings(raw, base) : DEFAULT_SETTINGS;
}

export async function saveSettings(slug: string, next: Settings, base: Product[]) {
  const clean = normalizeSettings({ ...next, updatedAt: new Date().toISOString() }, base);
  await putJSON(PATH(slug), clean);
  // Appelé depuis une server action : effet immédiat sur tout le site
  updateTag(`settings:${slug}`);
  revalidatePath(`/s/${slug}`, "layout");
  return clean;
}
