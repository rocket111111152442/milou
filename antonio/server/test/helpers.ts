import { eq } from "drizzle-orm";
import { db, schema } from "../src/db/client.js";
import { register } from "../src/auth/service.js";
import { createDemoConnection } from "../src/connectors/demo/seed.js";
import { registerJobHandlers } from "../src/jobs/handlers.js";
import { useInlineQueue } from "../src/jobs/queue.js";
import { setAutonomy } from "../src/lib/profile.js";
import type { Actor } from "../src/connectors/service.js";

let ready = false;
export function setupInline() {
  if (ready) return;
  useInlineQueue();
  registerJobHandlers();
  ready = true;
}

let n = 0;
export async function makeUser(name = "Camille Test") {
  setupInline();
  n++;
  const { user, org } = await register({
    email: `user${Date.now()}${n}@test.example`,
    password: "motdepasse-solide",
    displayName: name,
    withDemo: false,
  });
  await db().update(schema.profiles).set({ timezone: "Europe/Paris", onboardingCompletedAt: new Date() }).where(eq(schema.profiles.userId, user.id));
  return { userId: user.id, orgId: org.id, email: user.email } as Actor & { email: string };
}

export async function demoUser() {
  const actor = await makeUser();
  const conn = await createDemoConnection(actor);
  return { actor, conn };
}

export async function messageBySubject(userId: string, fragment: string) {
  const rows = await db().select().from(schema.messages).where(eq(schema.messages.userId, userId));
  const m = rows.find((r) => r.subject.includes(fragment));
  if (!m) throw new Error(`message « ${fragment} » introuvable`);
  return m;
}

export async function autoFor(actor: Actor, ...cats: ("messages" | "calendar" | "filing" | "tasks")[]) {
  for (const c of cats) await setAutonomy(actor.userId, c, "auto");
}

export async function actionRow(id: string) {
  const [a] = await db().select().from(schema.actions).where(eq(schema.actions.id, id));
  return a;
}
