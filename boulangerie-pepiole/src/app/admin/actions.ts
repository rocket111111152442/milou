"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, checkPassword, isAdmin, sessionToken } from "@/lib/admin-auth";
import { ORDER_STATUSES, setOrderStatus, type OrderStatus } from "@/lib/orders-store";

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
