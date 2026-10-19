"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SITE_COOKIE, isSiteAdmin, siteToken, verifyPassword } from "@/lib/auth";
import { ORDER_STATUSES, deleteOrder as removeOrder, setOrderStatus, type OrderStatus } from "@/lib/orders-store";
import { getSettingsFresh, saveSettings } from "@/lib/settings-store";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { getTenantFresh, savePhoto } from "@/lib/tenant-store";
import { wipePrefix, removeFile } from "@/lib/store";
import { notifyTest, removeDevice, saveDevice } from "@/lib/push";
import type { PushSubscription } from "web-push";
import { randomBytes } from "node:crypto";

const adminPath = (slug: string) => `/s/${slug}/admin`;

// Anti force brute : 5 essais par IP et par site toutes les 15 minutes (mémoire de l'instance)
const attempts = new Map<string, number[]>();

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const slug = String(form.get("slug") ?? "");
  const tenant = /^[a-z0-9-]+$/.test(slug) ? await getTenantFresh(slug) : null;
  if (!tenant) return "Site introuvable.";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const key = `${slug}:${ip}`;
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < 15 * 60_000);
  if (recent.length >= 5) return "Trop d'essais. Réessayez dans 15 minutes.";

  if (!verifyPassword(String(form.get("password") ?? ""), tenant.passwordHash)) {
    attempts.set(key, [...recent, now]);
    return "Mot de passe incorrect.";
  }
  attempts.delete(key);
  (await cookies()).set(SITE_COOKIE, siteToken(slug, tenant.passwordHash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: adminPath(slug),
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(adminPath(slug));
}

export async function logout(slug: string) {
  (await cookies()).delete({ name: SITE_COOKIE, path: adminPath(slug) });
  redirect(adminPath(slug));
}

/** Vérifie que l'appelant est connecté à l'espace de ce site ; renvoie le site. */
async function guard(slug: string) {
  const tenant = /^[a-z0-9-]+$/.test(slug) ? await getTenantFresh(slug) : null;
  if (!tenant || !(await isSiteAdmin(slug, tenant.passwordHash))) throw new Error("Non autorisé");
  return tenant;
}

export async function updateStatus(slug: string, orderNumber: string, status: OrderStatus) {
  await guard(slug);
  if (!ORDER_STATUSES.includes(status)) throw new Error("Statut invalide");
  await setOrderStatus(slug, orderNumber, status);
  revalidatePath(adminPath(slug));
}

export async function deleteOrder(slug: string, orderNumber: string) {
  await guard(slug);
  await removeOrder(slug, orderNumber);
  revalidatePath(adminPath(slug));
}

/** Remise à zéro : commandes, réglages, produits ajoutés et leurs photos, appareils notifiés. Le site lui-même reste. */
export async function resetAll(slug: string, confirmation: string) {
  const tenant = await guard(slug);
  if (confirmation !== "EFFACER") throw new Error("Confirmation incorrecte");
  const [orders, photos, devices] = await Promise.all([wipePrefix(`t/${slug}/commandes/`), wipePrefix(`t/${slug}/photos/p-`), wipePrefix(`t/${slug}/push/`)]);
  await removeFile(`t/${slug}/reglages.json`);
  await saveSettings(slug, DEFAULT_SETTINGS, tenant.products);
  revalidatePath(adminPath(slug), "layout");
  return { orders, photos, devices };
}

/** Modifie une partie des réglages (les autres champs sont conservés). */
export async function updateSettings(slug: string, patch: Partial<Settings>) {
  const tenant = await guard(slug);
  const current = await getSettingsFresh(slug, tenant.products);
  return saveSettings(slug, { ...current, ...patch }, tenant.products);
}

export async function subscribeDevice(slug: string, subscription: PushSubscription, shops: string[], label: string) {
  const tenant = await guard(slug);
  if (!subscription?.endpoint?.startsWith("https://")) throw new Error("Abonnement invalide");
  const ids = tenant.shops.map((s) => s.id);
  const valid = shops.filter((s) => ids.includes(s));
  await saveDevice(slug, { subscription, shops: valid.length ? valid : ids, label: label.slice(0, 60), createdAt: new Date().toISOString() });
  return notifyTest(slug, null);
}

export async function unsubscribeDevice(slug: string, endpoint: string) {
  await guard(slug);
  await removeDevice(slug, endpoint);
}

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Envoie une photo de produit (redimensionnée côté navigateur) ; renvoie son adresse publique. */
export async function uploadPhoto(slug: string, form: FormData): Promise<string> {
  await guard(slug);
  const file = form.get("photo");
  if (!(file instanceof File)) throw new Error("Aucune photo reçue");
  const ext = PHOTO_TYPES[file.type];
  if (!ext) throw new Error("Format accepté : JPEG, PNG ou WebP");
  if (file.size > 4 * 1024 * 1024) throw new Error("Photo trop lourde (4 Mo maximum)");
  const name = `p-${randomBytes(8).toString("hex")}.${ext}`;
  await savePhoto(slug, name, Buffer.from(await file.arrayBuffer()), file.type);
  return `/s/${slug}/api/photo/${name}`;
}
