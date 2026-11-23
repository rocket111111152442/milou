import { and, eq } from "drizzle-orm";
import type { AutonomyLevel, Category } from "@antonio/shared";
import { CATEGORIES } from "@antonio/shared";
import { db, schema } from "../db/client.js";

export type ProfileRow = typeof schema.profiles.$inferSelect;

export async function getProfile(userId: string): Promise<ProfileRow> {
  const [p] = await db().select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  if (!p) throw new Error("Profil introuvable");
  return p;
}

/** Niveau initial : préparation avec validation (jamais d'exécution automatique par défaut). */
export async function autonomyLevel(userId: string, category: Category): Promise<AutonomyLevel> {
  const [row] = await db()
    .select()
    .from(schema.autonomy)
    .where(and(eq(schema.autonomy.userId, userId), eq(schema.autonomy.category, category)));
  return (row?.level as AutonomyLevel) ?? "prepare";
}

export async function allAutonomy(userId: string): Promise<Record<Category, AutonomyLevel>> {
  const rows = await db().select().from(schema.autonomy).where(eq(schema.autonomy.userId, userId));
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, "prepare"])) as Record<Category, AutonomyLevel>;
  for (const r of rows) out[r.category as Category] = r.level as AutonomyLevel;
  return out;
}

export async function setAutonomy(userId: string, category: Category, level: AutonomyLevel) {
  await db()
    .insert(schema.autonomy)
    .values({ userId, category, level })
    .onConflictDoUpdate({ target: [schema.autonomy.userId, schema.autonomy.category], set: { level, updatedAt: new Date() } });
}
