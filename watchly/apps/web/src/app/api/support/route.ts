import { randomUUID } from "node:crypto";
import { z } from "zod";
import { supportMessages, supportTickets } from "@watchly/database";
import { queueEmail } from "@watchly/notifications";
import { apiError, handleApiError, json, readJson, sameOrigin } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromRequest, ipKey } from "@/lib/request";

export async function POST(req: Request) {
  try {
    if (!isDatabaseConfigured()) return apiError(503, "not_configured", "L'assistance en ligne n'est pas encore disponible sur cet environnement.");
    if (!sameOrigin(req)) return apiError(403, "bad_origin");
    const rl = await rateLimit(`support:${ipKey(ipFromRequest(req))}`, 5, 3600);
    if (!rl.ok) return apiError(429, "rate_limited", "Trop de demandes. Réessayez dans une heure.");
    const body = await readJson(
      req,
      z.object({
        email: z.string().trim().toLowerCase().email().max(254),
        category: z.enum(["account", "billing", "monitoring", "business", "desktop", "privacy", "abuse", "other"]).default("other"),
        subject: z.string().trim().min(3).max(200),
        message: z.string().trim().min(10).max(5000),
        website: z.string().max(0).optional().or(z.literal("")),
      }),
    );
    if (!body.ok) return body.res;
    if (body.data.website) return json({ ok: true }); // champ piège rempli par un robot
    const user = await getCurrentUser().catch(() => null);
    const db = getDb();
    const ticketId = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(supportTickets)
        .values({ userId: user?.id ?? null, email: body.data.email, subject: body.data.subject, category: body.data.category })
        .returning({ id: supportTickets.id });
      await tx.insert(supportMessages).values({ ticketId: t!.id, userId: user?.id ?? null, author: "user", body: body.data.message });
      await queueEmail(tx, {
        toEmail: body.data.email,
        userId: user?.id ?? null,
        template: "support_ack",
        subject: "Votre demande d'assistance Watchly",
        payload: { subject: body.data.subject, ticketRef: t!.id.slice(0, 8).toUpperCase() },
        idempotencyKey: `support:${t!.id}:${randomUUID()}`,
      });
      return t!.id;
    });
    return json({ ok: true, reference: ticketId.slice(0, 8).toUpperCase() }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
