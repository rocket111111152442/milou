/**
 * Test de bout en bout du worker : planification -> exécution cloud -> résultat -> alerte -> e-mail.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emailOutbox, eq, monitoringResults, notifications, subscriptions, workerHeartbeats } from "@watchly/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@watchly/database/testing";
import { recomputeEntitlements } from "@watchly/billing";
import { createMonitor } from "@watchly/monitoring";
import { startWorker } from "../src/index";

let t: TestDatabase;
let shop: Server;
let resend: Server;
let shopPort = 0;
let resendPort = 0;
let price = "899,00";
const sentEmails: Array<{ to: string[]; subject: string; idempotency?: string }> = [];

beforeAll(async () => {
  t = await createTestDatabase();
  shop = createServer((req, res) => {
    if (req.url === "/robots.txt") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<html><head><title>PC</title><script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"${price.replace(",", ".")}","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script></head><body>PC portable ${price} €</body></html>`);
  });
  resend = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const j = JSON.parse(body);
      sentEmails.push({ to: j.to, subject: j.subject, idempotency: req.headers["idempotency-key"] as string });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: `email_${sentEmails.length}` }));
    });
  });
  await new Promise<void>((r) => shop.listen(0, "127.0.0.1", () => r()));
  await new Promise<void>((r) => resend.listen(0, "127.0.0.1", () => r()));
  shopPort = (shop.address() as { port: number }).port;
  resendPort = (resend.address() as { port: number }).port;
});
afterAll(async () => {
  shop.close();
  resend.close();
  await t?.drop();
});

async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 20_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("timeout waiting for condition");
}

describe("worker end-to-end", () => {
  it("checks a page in the cloud, alerts on the price drop and sends the e-mail", async () => {
    const u = await createTestUser(t, "client@example.test");
    await t.db.insert(subscriptions).values({ userId: u.id, planId: "pro", stripeSubscriptionId: `sub_${u.id}`, stripeCustomerId: "cus_x", status: "active", currentPeriodEnd: new Date(Date.now() + 86_400_000 * 20) });
    await recomputeEntitlements(t.db, u.id);
    const m = await createMonitor(
      t.db,
      u.id,
      {
        kind: "page",
        name: "PC portable",
        url: `http://127.0.0.1:${shopPort}/pc`,
        renderMode: "http",
        condition: { type: "price_below", threshold: 800, currency: "EUR" },
        executionMode: "auto",
        notify: { inapp: true, email: true, desktop: true },
      },
      new Date(),
      { allowLoopback: true, allowAnyPort: true },
    );

    const worker = await startWorker({
      NODE_ENV: "test",
      DATABASE_URL: t.url,
      WORKER_ID: "test-worker",
      WORKER_ROLES: "scheduler,pages,email",
      WORKER_BROWSER_CONCURRENCY: "0",
      WATCHLY_ALLOW_PRIVATE_TARGETS: "1",
      RESEND_API_KEY: "re_test",
      RESEND_API_BASE: `http://127.0.0.1:${resendPort}`,
      EMAIL_FROM: "Watchly <test@watchly.invalid>",
      APP_URL: "https://app.test",
      LOG_LEVEL: "error",
    });
    try {
      const first = await waitFor(async () => (await t.db.select().from(monitoringResults).where(eq(monitoringResults.taskId, m.id)))[0]);
      expect(first).toMatchObject({ outcome: "ok", executedBy: "cloud" });
      expect((first.observation as { price: number }).price).toBe(899);

      // Le prix baisse : vérification manuelle immédiate
      price = "789,00";
      await t.db.execute(`delete from page_cache` as never);
      const { enqueueImmediate } = await import("@watchly/monitoring");
      await enqueueImmediate(t.db, { taskId: m.id, userId: u.id, manual: true });
      const notif = await waitFor(async () => (await t.db.select().from(notifications).where(eq(notifications.taskId, m.id)))[0]);
      expect(notif.type).toBe("price");
      expect(notif.title).toMatch(/^Le prix est passé sous 800,00\s€$/);
      await waitFor(async () => (await t.db.select().from(emailOutbox).where(eq(emailOutbox.notificationId, notif.id)))[0]?.status === "sent");
      expect(sentEmails.some((e) => e.to[0] === "client@example.test" && e.subject.includes("800") && e.idempotency === `notification:${notif.id}`)).toBe(true);

      // Le heartbeat (toutes les 30 s) reflète les compteurs du worker pour l'administration.
      const hb = await waitFor(async () => {
        const [row] = await t.db.select().from(workerHeartbeats).where(eq(workerHeartbeats.workerId, "test-worker"));
        return row && row.jobsSucceeded >= 2 ? row : null;
      }, 45_000);
      expect((hb.stats as { emailConfigured: boolean }).emailConfigured).toBe(true);
    } finally {
      await worker.stop();
    }
  }, 90_000);
});
