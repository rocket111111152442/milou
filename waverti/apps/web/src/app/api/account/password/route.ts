import { z } from "zod";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { eq, users } from "@waverti/database";
import { setPassword, verifyPassword } from "@waverti/auth";
import { getDb } from "@/lib/db";

/** Changement de mot de passe : le mot de passe actuel est vérifié avant la modification. */
export const POST = withActor(
  async (req) => {
    const body = await readJson(
      req,
      z.object({
        current: z.string().min(1).max(128),
        next: z
          .string()
          .min(10, "10 caractères minimum")
          .max(128)
          .refine((p) => /[a-zA-Z]/.test(p) && /[0-9\W_]/.test(p), "Mélangez lettres et chiffres ou symboles"),
      }),
    );
    if (!body.ok) return body.res;
    if (body.data.current === body.data.next) return apiError(422, "same_password", "Le nouveau mot de passe doit être différent.");
    const user = await getCurrentUser();
    const db = getDb();
    const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user!.id)).limit(1);
    if (!(await verifyPassword(body.data.current, u?.hash))) return apiError(403, "wrong_password", "Mot de passe actuel incorrect.");
    // Les autres sessions sont fermées ; la session courante (et son niveau de double authentification) est conservée.
    await setPassword(db, user!.id, body.data.next, user!.sessionId);
    return json({ ok: true });
  },
  { rate: { name: "password", limit: 5, windowSec: 3600 } },
);
