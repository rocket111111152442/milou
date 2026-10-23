import "server-only";
import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { dbEnabled, query } from "./db";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "./settings";

const KEY = "reglages";

async function readSettings(): Promise<Settings> {
  if (!dbEnabled()) return DEFAULT_SETTINGS;
  try {
    const { rows } = await query<{ data: unknown }>("select data from petrin_settings where key = $1", [KEY]);
    return rows[0] ? normalizeSettings(rows[0].data) : DEFAULT_SETTINGS;
  } catch (e) {
    // Base indisponible : le site reste visible avec les réglages par défaut
    console.warn("[settings] lecture impossible :", (e as Error).message);
    return DEFAULT_SETTINGS;
  }
}

/** Réglages, mis en cache et invalidés à chaque enregistrement depuis /admin. */
export const getSettings = unstable_cache(readSettings, ["reglages"], { tags: ["reglages"], revalidate: 300 });

/** Lecture directe, sans cache (pour modifier puis réenregistrer). */
export const getSettingsFresh = readSettings;

export async function saveSettings(next: Settings) {
  const clean = normalizeSettings({ ...next, updatedAt: new Date().toISOString() });
  await query(
    `insert into petrin_settings (key, data, updated_at) values ($1, $2, now())
     on conflict (key) do update set data = excluded.data, updated_at = now()`,
    [KEY, JSON.stringify(clean)],
  );
  // Appelé depuis une server action : effet immédiat sur tout le site
  updateTag("reglages");
  revalidatePath("/", "layout");
  return clean;
}
