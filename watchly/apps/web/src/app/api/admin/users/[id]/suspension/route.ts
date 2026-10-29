import { z } from "zod";
import { eq, isUuid, profiles } from "@watchly/database";
import { apiError, json, readJson } from "@/lib/api";
import { withAdmin } from "@/lib/admin";
import { audit } from "@/lib/data/admin";
import { getDb } from "@/lib/db";

const schema = z.object({ suspended: z.boolean(), reason: z.string().trim().min(5, "Motif obligatoire (5 caractères minimum).").max(500) });

/** Suspension / réactivation d'un compte, avec motif obligatoire et trace dans le journal d'audit. */
export const POST = withAdmin(async (req, admin, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  if (id === admin.userId) return apiError(409, "self", "Vous ne pouvez pas suspendre votre propre compte.");
  const body = await readJson(req, schema);
  if (!body.ok) return body.res;
  const db = getDb();
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(profiles)
      .set(body.data.suspended ? { suspendedAt: new Date(), suspensionReason: body.data.reason } : { suspendedAt: null, suspensionReason: null })
      .where(eq(profiles.id, id!))
      .returning({ id: profiles.id });
    if (!updated.length) return apiError(404, "not_found");
    await audit(tx, { adminId: admin.userId, action: body.data.suspended ? "user.suspend" : "user.unsuspend", targetType: "user", targetId: id!, reason: body.data.reason });
    return json({ ok: true });
  });
});
