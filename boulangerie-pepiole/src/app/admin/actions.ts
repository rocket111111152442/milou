"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, checkPassword, isAdmin, sessionToken } from "@/lib/admin-auth";
import { ORDER_STATUSES, deleteOrder as removeOrder, setOrderStatus, wipeOrders, type OrderStatus } from "@/lib/orders-store";
import { savePhoto, wipePhotos } from "@/lib/photos-store";
import { getSettingsFresh, saveSettings } from "@/lib/settings-store";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { SHOP_IDS, type ShopId } from "@/lib/shops";
import { notifyTest, removeDevice, saveDevice, wipeDevices } from "@/lib/push";
import type { PushSubscription } from "web-push";
import { randomBytes } from "node:crypto";

// Anti force brute : 5 essais par IP toutes les 15 minutes (mémoire de l'instance)
const attempts = new Map<string, number[]>();

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
  if (recent.length >= 5) return "Trop d'essais. Réessayez dans 15 minutes.";

  if (!checkPassword(String(form.get("password") ?? ""))) {
    attempts.set(ip, [...recent, now]);
    return "Mot de passe incorrect.";
  }
  attempts.delete(ip);
  (await cookies()).set(ADMIN_COOKIE, sessionToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin");
}

export async function updateStatus(orderNumber: string, status: OrderStatus) {
  if (!(await isAdmin())) throw new Error("Non autorisé");
  if (!ORDER_STATUSES.includes(status)) throw new Error("Statut invalide");
  await setOrderStatus(orderNumber, status);
  revalidatePath("/admin");
}

export async function deleteOrder(orderNumber: string) {
  if (!(await isAdmin())) throw new Error("Non autorisé");
  await removeOrder(orderNumber);
  revalidatePath("/admin");
}

/** Remise à zéro complète : commandes, réglages, produits ajoutés et leurs photos, appareils notifiés. */
export async function resetAll(confirmation: string) {
  if (!(await isAdmin())) throw new Error("Non autorisé");
  if (confirmation !== "EFFACER") throw new Error("Confirmation incorrecte");
  const [orders, photos, devices] = await Promise.all([wipeOrders(), wipePhotos(), wipeDevices()]);
  await saveSettings(DEFAULT_SETTINGS);
  revalidatePath("/admin", "layout");
  return { orders, photos, devices };
}

// --- Réglages -----------------------------------------------------------


async function guard() {
  if (!(await isAdmin())) throw new Error("Non autorisé");
}

/** Modifie une partie des réglages (les autres champs sont conservés). */
export async function updateSettings(patch: Partial<Settings>): Promise<{ ok: true } | { ok: false; error: string }> {
  await guard();
  try {
    const current = await getSettingsFresh();
    await saveSettings({ ...current, ...patch });
    return { ok: true };
  } catch (e) {
    // Renvoyé comme résultat (et non levé) : en production, une erreur levée par une action serveur
    // arrive masquée dans le navigateur (« Minified React error #441 »).
    console.error("[admin] enregistrement des réglages :", e);
    return { ok: false, error: (e as Error).message };
  }
}

export async function subscribeDevice(subscription: PushSubscription, shops: ShopId[], label: string) {
  await guard();
  if (!subscription?.endpoint?.startsWith("https://")) throw new Error("Abonnement invalide");
  const valid = shops.filter((s) => SHOP_IDS.includes(s));
  await saveDevice({ subscription, shops: valid.length ? valid : [...SHOP_IDS], label: label.slice(0, 60), createdAt: new Date().toISOString() });
  return notifyTest(null);
}

export async function unsubscribeDevice(endpoint: string) {
  await guard();
  await removeDevice(endpoint);
}

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Envoie une photo de produit (redimensionnée côté navigateur) ; renvoie son adresse publique. */
export async function uploadPhoto(form: FormData): Promise<string> {
  await guard();
  const file = form.get("photo");
  if (!(file instanceof File)) throw new Error("Aucune photo reçue");
  const ext = PHOTO_TYPES[file.type];
  if (!ext) throw new Error("Format accepté : JPEG, PNG ou WebP");
  if (file.size > 4 * 1024 * 1024) throw new Error("Photo trop lourde (4 Mo maximum)");
  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  await savePhoto(name, Buffer.from(await file.arrayBuffer()), file.type);
  return `/api/photo/${name}`;
}
