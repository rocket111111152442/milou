import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listMigrations, MIGRATIONS_DIR } from "../src/migrations";
import { createTestDatabase, type TestDatabase } from "../src/testing";

const PENDING_DIR = resolve(MIGRATIONS_DIR, "../migrations-pending");
const FILE = "20261102000000_product_catalog.sql";
const H = "a".repeat(64);

let t: TestDatabase;
let productId: string;
let merchantId: string;

async function allow(source: string, on = true) {
  await t.client.unsafe(
    on
      ? `update public.source_policies set storage_allowed = true, confirmed_at = now(), evidence_ref = 'test-evidence-ref' where source = '${source}'`
      : `update public.source_policies set storage_allowed = false where source = '${source}'`,
  );
}
async function offer(url: string | null, origin = "merchant_crawl", hash = H): Promise<string> {
  const [r] = await t.client.unsafe<{ id: string }[]>(
    `insert into public.product_offers (product_id, merchant_id, url_hash, url, discovery_origin)
     values ('${productId}', '${merchantId}', '${hash}', ${url ? `'${url}'` : "null"}, '${origin}') returning id`,
  );
  return r!.id;
}
async function obs(offerId: string, at: string, cents: number, extra: { cur?: string; avail?: string } = {}) {
  await t.client.unsafe(
    `insert into public.offer_observations (offer_id, checked_at, price_cents, currency, availability, shipping_kind, price_source, data_fingerprint)
     values ('${offerId}', '${at}', ${cents}, '${extra.cur ?? "EUR"}', '${extra.avail ?? "in_stock"}', 'unknown', 'jsonld', '${H}')`,
  );
}
async function fails(run: () => Promise<unknown>, re: RegExp) {
  const e = await run().then(() => null, (x: unknown) => x as Error);
  expect(e, "une erreur était attendue").not.toBeNull();
  expect(String(e?.message)).toMatch(re);
}

beforeAll(async () => {
  t = await createTestDatabase();
  await t.client.unsafe(readFileSync(resolve(PENDING_DIR, FILE), "utf8"));
  const [p] = await t.client<{ id: string }[]>`insert into public.product_identities (identity_key, name) values ('sony|wh1000xm5', 'Sony WH-1000XM5') returning id`;
  const [m] = await t.client<{ id: string }[]>`insert into public.merchants (domain, display_name) values ('shop.example', 'Shop') returning id`;
  productId = p!.id;
  merchantId = m!.id;
});
afterAll(async () => {
  await t.drop();
});

describe("migrations préparées — isolation", () => {
  it("le dossier des migrations appliquées ne contient pas la migration préparée", () => {
    expect(readdirSync(PENDING_DIR)).toContain(FILE);
    expect(listMigrations().map((m) => m.path.split("/").pop())).not.toContain(FILE);
  });
});

describe("catalogue — fail-closed", () => {
  it("toutes les sources sont refusées par défaut", async () => {
    const rows = await t.client`select source, storage_allowed from public.source_policies order by source`;
    expect(rows.map((r) => r.source)).toEqual(["brave", "import", "merchant_page", "user_supplied"]);
    expect(rows.every((r) => r.storage_allowed === false)).toBe(true);
  });

  it("refuse toute offre et toute observation tant que merchant_page n'est pas autorisée", async () => {
    await fails(() => offer("https://shop.example/p/1"), /catalog_storage_not_authorized/);
  });

  it("une autorisation exige une date et une référence de justificatif", async () => {
    await fails(() => t.client.unsafe(`update public.source_policies set storage_allowed = true where source = 'brave'`), /source_policies_evidence/);
    await fails(
      () => t.client.unsafe(`update public.source_policies set storage_allowed = true, confirmed_at = now(), evidence_ref = 'x' where source = 'brave'`),
      /source_policies_evidence/,
    );
  });
});

describe("catalogue — avec merchant_page autorisée", () => {
  beforeAll(async () => {
    await allow("merchant_page");
  });
  afterAll(async () => {
    await allow("merchant_page", false);
  });

  it("une adresse découverte par Brave exige le droit Brave ; son empreinte seule est acceptée", async () => {
    await fails(() => offer("https://shop.example/brave-1", "brave", "b".repeat(64)), /la source brave/);
    const id = await offer(null, "brave", "b".repeat(64));
    expect(id).toBeTruthy();
  });

  it("enregistre l'historique : première vue, baisse de prix, disponibilité, changement de devise isolé", async () => {
    const id = await offer("https://shop.example/p/2", "merchant_crawl", "c".repeat(64));
    await obs(id, "2026-11-01T10:00:00Z", 10000);
    await obs(id, "2026-11-02T10:00:00Z", 9000, { avail: "out_of_stock" });
    await obs(id, "2026-11-03T10:00:00Z", 8000, { cur: "USD", avail: "out_of_stock" });
    const ch = await t.client`select kind, price_delta_cents, price_delta_pct from public.offer_changes where offer_id = ${id} order by changed_at, id`;
    expect(ch.map((c) => c.kind)).toEqual(["first_seen", "price", "availability", "currency"]);
    expect(Number(ch[1]!.price_delta_cents)).toBe(-1000);
    expect(Number(ch[1]!.price_delta_pct)).toBe(-10);
    const [o] = await t.client`select current_price_cents, current_currency, last_status, consecutive_failures from public.product_offers where id = ${id}`;
    expect(Number(o!.current_price_cents)).toBe(8000);
    expect(o!.current_currency).toBe("USD");
    expect(o!.last_status).toBe("ok");
  });

  it("une observation tardive est conservée sans modifier l'instantané ni l'historique", async () => {
    const id = await offer("https://shop.example/p/3", "merchant_crawl", "d".repeat(64));
    await obs(id, "2026-11-05T10:00:00Z", 5000);
    await obs(id, "2026-11-01T10:00:00Z", 7000);
    const [o] = await t.client`select current_price_cents from public.product_offers where id = ${id}`;
    expect(Number(o!.current_price_cents)).toBe(5000);
    const n = await t.client`select count(*)::int as n from public.offer_observations where offer_id = ${id}`;
    expect(n[0]!.n).toBe(2);
    const ch = await t.client`select kind from public.offer_changes where offer_id = ${id}`;
    expect(ch.map((c) => c.kind)).toEqual(["first_seen"]);
  });

  it("les échecs incrémentent le compteur et un succès le remet à zéro", async () => {
    const id = await offer("https://shop.example/p/4", "merchant_crawl", "e".repeat(64));
    await t.client.unsafe(`insert into public.verification_failures (offer_id, reason, transient) values ('${id}', 'timeout', true), ('${id}', 'http_503', true)`);
    let [o] = await t.client`select last_status, consecutive_failures from public.product_offers where id = ${id}`;
    expect(o).toMatchObject({ last_status: "failed", consecutive_failures: 2 });
    await obs(id, "2026-11-06T10:00:00Z", 1234);
    [o] = await t.client`select last_status, consecutive_failures from public.product_offers where id = ${id}`;
    expect(o).toMatchObject({ last_status: "ok", consecutive_failures: 0 });
  });

  it("refuse les valeurs incohérentes (prix nul, devise, frais)", async () => {
    const id = await offer("https://shop.example/p/5", "merchant_crawl", "f".repeat(64));
    await fails(() => obs(id, "2026-11-01T10:00:00Z", 0), /price_cents|check/);
    await fails(() => obs(id, "2026-11-01T10:00:00Z", 100, { cur: "eur" }), /currency|check/);
    await fails(
      () =>
        t.client.unsafe(
          `insert into public.offer_observations (offer_id, checked_at, price_cents, currency, availability, shipping_kind, price_source, data_fingerprint)
           values ('${id}', now(), 100, 'EUR', 'in_stock', 'known', 'jsonld', '${H}')`,
        ),
      /shipping_consistent/,
    );
  });

  it("la révocation Brave efface les adresses issues de Brave, même si la source marchande est refusée ensuite", async () => {
    await allow("brave");
    const id = await offer("https://shop.example/brave-2", "brave", "1".repeat(64));
    await allow("merchant_page", false);
    const [r] = await t.client`select public.catalog_revoke_source('brave', 'fin de contrat') as n`;
    expect(Number(r!.n)).toBe(1);
    const [o] = await t.client`select url from public.product_offers where id = ${id}`;
    expect(o!.url).toBeNull();
    const [s] = await t.client`select storage_allowed from public.source_policies where source = 'brave'`;
    expect(s!.storage_allowed).toBe(false);
    await allow("merchant_page");
  });

  it("la rétention supprime l'ancien, garde le récent, et ne touche pas aux autres données", async () => {
    const old = await offer("https://shop.example/old", "merchant_crawl", "2".repeat(64));
    await obs(old, "2025-01-01T10:00:00Z", 100);
    const fresh = await offer("https://shop.example/fresh", "merchant_crawl", "3".repeat(64));
    await obs(fresh, "2026-11-01T09:00:00Z", 100);
    const [r] = await t.client`select * from public.catalog_apply_retention('2026-11-02T00:00:00Z'::timestamptz)`;
    expect(Number(r!.observations_deleted)).toBeGreaterThanOrEqual(1);
    const left = await t.client`select 1 from public.offer_observations where offer_id = ${fresh}`;
    expect(left.length).toBe(1);
    const gone = await t.client`select 1 from public.offer_observations where offer_id = ${old}`;
    expect(gone.length).toBe(0);
  });
});

describe("catalogue — accès", () => {
  it("RLS activée et aucun droit pour app_user", async () => {
    const rls = await t.client`select relname, relrowsecurity from pg_class where relname in ('source_policies','product_identities','merchants','product_offers','offer_observations','offer_changes','verification_failures') and relkind = 'r'`;
    expect(rls.length).toBe(7);
    expect(rls.every((r) => r.relrowsecurity)).toBe(true);
    const [g] = await t.client`select has_table_privilege('app_user', 'public.product_offers', 'select') as s, has_table_privilege('app_user', 'public.offer_observations', 'insert') as i`;
    expect(g).toMatchObject({ s: false, i: false });
  });
});
