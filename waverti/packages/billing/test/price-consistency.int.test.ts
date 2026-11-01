import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@waverti/database/testing";
import { formatCents } from "@waverti/types";
import { PAID_PLAN_IDS, PLAN_CATALOG } from "../src/catalog";

/**
 * Cohérence des prix : catalogue (code) = base PostgreSQL migrée = pages publiques (textes écrits en dur).
 * Stripe n'est PAS couvert ici (aucun accès) : `pnpm stripe:prices` (lecture seule) compare Stripe au catalogue.
 */
const EXPECTED = { plus: 999, pro: 1999, max: 2999, business: 4999 } as const;
const LOOKUP = { plus: "waverti_plus_monthly", pro: "waverti_pro_monthly", max: "waverti_max_monthly", business: "waverti_business_monthly" } as const;

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t.drop();
});

describe("prix : catalogue, base de données, pages publiques", () => {
  it("le catalogue porte les quatre prix décidés et les bonnes clés de recherche", () => {
    expect([...PAID_PLAN_IDS].sort()).toEqual(["business", "max", "plus", "pro"]);
    for (const id of PAID_PLAN_IDS) {
      expect(PLAN_CATALOG[id].priceCents, id).toBe(EXPECTED[id]);
      expect(PLAN_CATALOG[id].stripeLookupKey, id).toBe(LOOKUP[id]);
    }
  });

  it("la base migrée (toutes les migrations) a les mêmes montants et clés que le catalogue", async () => {
    const rows = await t.client<{ id: string; price_cents: number; stripe_lookup_key: string }[]>`select id, price_cents, stripe_lookup_key from plans where id = any(${[...PAID_PLAN_IDS]})`;
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.price_cents, r.id).toBe(PLAN_CATALOG[r.id as keyof typeof PLAN_CATALOG].priceCents);
      expect(r.stripe_lookup_key, r.id).toBe(LOOKUP[r.id as keyof typeof LOOKUP]);
    }
  });

  it("aucun montant écrit en dur dans les pages publiques ne diffère du catalogue", () => {
    const allowed = new Set(PAID_PLAN_IDS.map((id) => formatCents(PLAN_CATALOG[id].priceCents).replace(/\s/g, " ")));
    const root = resolve(__dirname, "../../../apps/web/src");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|mdx?)$/.test(f) && /(marketing|\(marketing\)|app\/page|abonnement)/.test(p)) files.push(p);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(5);
    const bad: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/(\d{1,3}),(99)\s?€/g)) {
        const amount = `${m[1]},${m[2]} €`;
        // Tous les prix de formule se terminent par « ,99 » : tout montant de ce type doit être celui du catalogue
        // (les exemples de démonstration d'un produit, comme 899,00 €, ne sont pas concernés).
        if (!allowed.has(amount) && !/(exemple|démo|demo|NumWorks|casque|€ par mois\s*\/\s*an)/i.test(readFileSync(f, "utf8").slice(Math.max(0, m.index - 200), m.index + 200))) bad.push(`${f.replace(root, "")} : ${amount}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
