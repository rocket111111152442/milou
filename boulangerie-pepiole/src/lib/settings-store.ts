import "server-only";
import { get, put } from "@vercel/blob";
import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "./settings";

const PATH = "config/reglages.json";

async function readSettings(): Promise<Settings> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return DEFAULT_SETTINGS;
  try {
    const res = await get(PATH, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(await new Response(res.stream).text()));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Réglages, mis en cache et invalidés à chaque enregistrement depuis /admin. */
export const getSettings = unstable_cache(readSettings, ["reglages"], { tags: ["reglages"], revalidate: 300 });

/** Lecture directe, sans cache (pour modifier puis réenregistrer). */
export const getSettingsFresh = readSettings;

export async function saveSettings(next: Settings) {
  const clean = normalizeSettings({ ...next, updatedAt: new Date().toISOString() });
  await put(PATH, JSON.stringify(clean), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  // Appelé depuis une server action : effet immédiat sur tout le site
  updateTag("reglages");
  revalidatePath("/", "layout");
  return clean;
}
