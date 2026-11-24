import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "./session";

export interface AdminUser { id: number; email: string; name: string }

/** Server-side access control for every admin page, action and route. */
export async function getAdmin(): Promise<AdminUser | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const db = await getDb();
  const [u] = await db.select({ id: schema.adminUsers.id, email: schema.adminUsers.email, name: schema.adminUsers.name }).from(schema.adminUsers).where(eq(schema.adminUsers.id, session.uid));
  return u ?? null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const u = await getAdmin();
  if (!u) redirect("/admin/login");
  return u;
}
