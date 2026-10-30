import { z } from "zod";
import { eq, isUuid, supportMessages, supportTickets } from "@waverti/database";
import { queueEmail } from "@waverti/notifications";
import { apiError, json, readJson } from "@/lib/api";
import { withAdmin } from "@/lib/admin";
import { audit } from "@/lib/data/admin";
import { getDb } from "@/lib/db";

const schema = z.union([
  z.object({ reply: z.string().trim().min(2).max(5000) }),
  z.object({ status: z.enum(["open", "pending", "closed"]) }),
]);

/** Réponse de l'équipe (envoyée par e-mail au demandeur) ou changement de statut d'une demande. */
export const POST = withAdmin(async (req, admin, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  const body = await readJson(req, schema);
  if (!body.ok) return body.res;
  const db = getDb();
  return db.transaction(async (tx) => {
    const [ticket] = await tx.select().from(supportTickets).where(eq(supportTickets.id, id!)).for("update").limit(1);
    if (!ticket) return apiError(404, "not_found");
    if ("reply" in body.data) {
      const [msg] = await tx
        .insert(supportMessages)
        .values({ ticketId: ticket.id, userId: null, author: "staff", body: body.data.reply })
        .returning({ id: supportMessages.id });
      await tx.update(supportTickets).set({ status: "pending", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
      await queueEmail(tx, {
        toEmail: ticket.email,
        userId: ticket.userId,
        template: "support_reply",
        subject: `Re : ${ticket.subject}`.slice(0, 200),
        payload: { body: body.data.reply, subject: ticket.subject, ticketRef: ticket.id.slice(0, 8).toUpperCase() },
        idempotencyKey: `support_reply:${msg!.id}`,
      });
      await audit(tx, { adminId: admin.userId, action: "ticket.reply", targetType: "ticket", targetId: ticket.id });
    } else {
      await tx.update(supportTickets).set({ status: body.data.status, updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
      await audit(tx, { adminId: admin.userId, action: `ticket.${body.data.status}`, targetType: "ticket", targetId: ticket.id });
    }
    return json({ ok: true });
  });
});

/** Aucune autre méthode : 404 (et non 405) pour ne pas révéler l'existence de la route. */
export const GET = () => apiError(404, "not_found");
