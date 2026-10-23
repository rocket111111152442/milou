import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySession } from "./auth";

/** Double vérification côté route (en plus du middleware). */
export async function requireAdmin() {
  const jar = await cookies();
  const ok = await verifySession(jar.get(ADMIN_COOKIE)?.value);
  return ok ? null : NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}
