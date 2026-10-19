"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { STUDIO_COOKIE, checkStudioPassword, generatePassword, hashPassword, isStudio, studioToken } from "@/lib/auth";
import { buildTenant, type TenantInput } from "@/lib/tenant-input";
import { RESERVED_SLUGS, SLUG, slugify, type TenantConfig } from "@/lib/tenant";
import { deleteTenant, getTenantFresh, listTenants, saveTenant } from "@/lib/tenant-store";
import { putFile, removeFile } from "@/lib/store";

const attempts = new Map<string, number[]>();

export async function studioLogin(_: string | null, form: FormData): Promise<string | null> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
  if (recent.length >= 5) return "Trop d'essais. Réessayez dans 15 minutes.";
  if (!checkStudioPassword(String(form.get("password") ?? ""))) {
    attempts.set(ip, [...recent, now]);
    return "Mot de passe incorrect.";
  }
  attempts.delete(ip);
  (await cookies()).set(STUDIO_COOKIE, studioToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/studio",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/studio");
}

export async function studioLogout() {
  (await cookies()).delete({ name: STUDIO_COOKIE, path: "/studio" });
  redirect("/studio");
}

async function guard() {
  if (!(await isStudio())) throw new Error("Non autorisé");
}

export type SaveResult =
  | { ok: true; slug: string; created: boolean; password?: string }
  | { ok: false; error: string };

/** Crée ou met à jour un site. `editSlug` : site existant à modifier. */
export async function saveSite(input: TenantInput, editSlug?: string): Promise<SaveResult> {
  await guard();
  const built = buildTenant(input);
  if ("error" in built) return { ok: false, error: built.error };

  let existing: TenantConfig | null = null;
  if (editSlug) {
    existing = await getTenantFresh(editSlug);
    if (!existing) return { ok: false, error: "Site introuvable." };
  }

  let slug = existing?.slug ?? slugify(input.slug || built.tenant.name);
  if (!existing) {
    if (!SLUG.test(slug) || RESERVED_SLUGS.has(slug)) return { ok: false, error: "Adresse du site invalide : 3 à 40 caractères (lettres, chiffres, tirets)." };
    const taken = new Set((await listTenants()).map((t) => t.slug));
    if (taken.has(slug)) return { ok: false, error: `L'adresse « ${slug} » est déjà utilisée : choisissez-en une autre.` };
  }

  const now = new Date().toISOString();
  let password: string | undefined;
  let passwordHash = existing?.passwordHash;
  const typed = input.password.trim();
  if (typed) {
    if (typed.length < 8) return { ok: false, error: "Le mot de passe doit faire au moins 8 caractères." };
    password = typed;
    passwordHash = hashPassword(typed);
  } else if (!passwordHash) {
    password = generatePassword();
    passwordHash = hashPassword(password);
  }
  slug = existing?.slug ?? slug;

  await saveTenant({
    ...built.tenant,
    slug,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    passwordHash: passwordHash!,
  });
  revalidatePath("/studio");
  revalidatePath(`/s/${slug}`, "layout");
  return { ok: true, slug, created: !existing, password };
}

export async function resetSitePassword(slug: string): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  await guard();
  const t = await getTenantFresh(slug);
  if (!t) return { ok: false, error: "Site introuvable." };
  const password = generatePassword();
  await saveTenant({ ...t, passwordHash: hashPassword(password), updatedAt: new Date().toISOString() });
  return { ok: true, password };
}

export async function deleteSite(slug: string): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const t = await getTenantFresh(slug);
  if (!t) return { ok: false, error: "Site introuvable." };
  // Photos du Studio utilisées par ce site
  const names = [t.heroImage, ...t.shops.map((s) => s.image)]
    .map((p) => p?.match(/^\/p\/([a-z0-9-]+\.(?:jpg|png|webp))$/)?.[1])
    .filter((n): n is string => Boolean(n));
  await Promise.all(names.map((n) => removeFile(`gphotos/${n}`).catch(() => {})));
  await deleteTenant(slug);
  revalidatePath("/studio");
  return { ok: true };
}

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Photo (façade, boutique, ambiance) réduite côté navigateur ; renvoie son adresse publique. */
export async function uploadSitePhoto(form: FormData): Promise<string> {
  await guard();
  const file = form.get("photo");
  if (!(file instanceof File)) throw new Error("Aucune photo reçue");
  const ext = PHOTO_TYPES[file.type];
  if (!ext) throw new Error("Format accepté : JPEG, PNG ou WebP");
  if (file.size > 4 * 1024 * 1024) throw new Error("Photo trop lourde (4 Mo maximum)");
  const name = `g-${randomBytes(8).toString("hex")}.${ext}`;
  await putFile(`gphotos/${name}`, Buffer.from(await file.arrayBuffer()), file.type);
  return `/p/${name}`;
}
