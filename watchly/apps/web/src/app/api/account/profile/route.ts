import { z } from "zod";
import { eq, profiles } from "@watchly/database";
import { json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

export const PATCH = withActor(
  async (req, actor) => {
    const body = await readJson(
      req,
      z.object({
        displayName: z.string().trim().max(80).nullable().optional(),
        timezone: z.string().refine((t) => TIMEZONES.has(t), "Fuseau horaire inconnu").optional(),
        notifyEmail: z.boolean().optional(),
        notifyInapp: z.boolean().optional(),
        notifyDesktop: z.boolean().optional(),
        marketingOptIn: z.boolean().optional(),
        onboardingStep: z.string().max(40).optional(),
        onboardingCompleted: z.boolean().optional(),
      }),
    );
    if (!body.ok) return body.res;
    const { onboardingCompleted, ...rest } = body.data;
    // Liste blanche explicite : rôle, suspension et identifiant Stripe ne sont jamais modifiables ici.
    await getDb()
      .update(profiles)
      .set({
        ...(rest.displayName !== undefined ? { displayName: rest.displayName || null } : {}),
        ...(rest.timezone ? { timezone: rest.timezone } : {}),
        ...(rest.notifyEmail !== undefined ? { notifyEmail: rest.notifyEmail } : {}),
        ...(rest.notifyInapp !== undefined ? { notifyInapp: rest.notifyInapp } : {}),
        ...(rest.notifyDesktop !== undefined ? { notifyDesktop: rest.notifyDesktop } : {}),
        ...(rest.marketingOptIn !== undefined ? { marketingOptIn: rest.marketingOptIn } : {}),
        ...(rest.onboardingStep ? { onboardingStep: rest.onboardingStep } : {}),
        ...(onboardingCompleted ? { onboardingCompletedAt: new Date() } : {}),
      })
      .where(eq(profiles.id, actor.userId));
    return json({ ok: true });
  },
  { rate: { name: "profile", limit: 60, windowSec: 3600 } },
);
