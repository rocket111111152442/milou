import { artifacts, isUuid, sql, withUser } from "@waverti/database";
import { apiError, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

/** Capture d'écran d'un scénario : lisible uniquement par son propriétaire (RLS). */
export const GET = withActor(async (_req, actor, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  const [a] = await withUser(getDb(), actor.userId, (tx) =>
    tx
      .select({ bytes: artifacts.bytes, contentType: artifacts.contentType })
      .from(artifacts)
      .where(sql`${artifacts.id} = ${id} and ${artifacts.expiresAt} > now()`)
      .limit(1),
  );
  if (!a) return apiError(404, "not_found");
  return new Response(new Uint8Array(a.bytes), {
    headers: {
      "content-type": a.contentType,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
});
