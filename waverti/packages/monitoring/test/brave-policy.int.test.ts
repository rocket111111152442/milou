/**
 * Conformité Brave : neutralisation des résultats déjà conservés quand les droits de stockage ne sont pas confirmés.
 * Base jetable ; aucune donnée réelle, aucun appel Brave.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { braveStorageRightsFromEnv, enforceBraveStoragePolicy, redactFinding } from "../src/search";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

const finding = { url: "https://editeur.example/annonce", title: "Projet Aurora le 14 mars", snippet: "Communiqué officiel du studio", domain: "editeur.example", publishedAt: "2026-10-01", classification: "confirmed", sourceTier: "official", extractedDate: "2027-03-14", reasons: ["Source officielle"], fingerprint: "a".repeat(40) };

async function seed() {
  const u = await createTestUser(t);
  const mk = async (kind: "web_topic" | "page") => {
    const [task] = await t.client<{ id: string }[]>`insert into monitoring_tasks (user_id, kind, name, condition) values (${u.id}, ${kind}, ${"t-" + kind}, '{}'::jsonb) returning id`;
    const [job] = await t.client<{ id: string }[]>`
      insert into monitoring_jobs (task_id, user_id, kind, slot_at, preferred_executor, allow_cloud, allow_agent) values (${task!.id}, ${u.id}, ${kind}, now(), 'cloud', true, false) returning id`;
    return { task: task!.id, job: job!.id };
  };
  const web = await mk("web_topic");
  const page = await mk("page");
  const k = u.id.slice(0, 8);
  await t.client`insert into search_cache (query_hash, provider, query, results, expires_at) values (${"h1" + k}, 'brave', 'requête a', ${JSON.stringify([finding])}::jsonb, now() + interval '1 hour'), (${"h2" + k}, 'brave_products', 'requête b', '[]'::jsonb, now() + interval '1 hour'), (${"h3" + k}, 'autre', 'x', '[]'::jsonb, now() + interval '1 hour')`;
  await t.client`insert into monitoring_seen_items (task_id, user_id, fingerprint, url, title, classification) values (${web.task}, ${u.id}, ${"f".repeat(40)}, 'https://editeur.example/annonce', 'Titre', 'confirmed'), (${page.task}, ${u.id}, ${"e".repeat(40)}, 'https://boutique.example/p', 'Fiche', 'probable')`;
  await t.client`insert into monitoring_results (job_id, task_id, user_id, executed_by, outcome, observation, change_summary) values
    (${web.job}, ${web.task}, ${u.id}, 'cloud', 'triggered', ${JSON.stringify({ kind: "web_topic", queries: ["q"], status: "confirmed", findings: [finding], newFingerprints: [], provider: "brave", fromCache: false, fetchedAt: "2026-11-01T10:00:00Z" })}::jsonb, ${JSON.stringify({ sourceUrl: finding.url, findings: [{ url: finding.url, title: finding.title }] })}::jsonb),
    (${page.job}, ${page.task}, ${u.id}, 'cloud', 'ok', ${JSON.stringify({ kind: "page", finalUrl: "https://boutique.example/p", price: 49.9 })}::jsonb, ${JSON.stringify({ priceFrom: 59.9 })}::jsonb)`;
  const [n] = await t.client<{ id: string }[]>`
    insert into notifications (user_id, type, title, body, task_id, source_url) values (${u.id}, 'web_topic', 'Confirmé : Projet Aurora le 14 mars', 'Source : editeur.example', ${web.task}, ${finding.url}), (${u.id}, 'price', 'Prix en baisse', 'Boutique', ${page.task}, 'https://boutique.example/p') returning id`;
  await t.client`insert into email_outbox (user_id, notification_id, to_email, template, subject, payload, status) values (${u.id}, ${n!.id}, 'a@example.test', 'alert', 'Confirmé : Projet Aurora le 14 mars', ${JSON.stringify({ url: finding.url, title: finding.title })}::jsonb, 'sent')`;
  return { web, page, user: u.id };
}

beforeEach(async () => {
  for (const tbl of ["email_outbox", "notifications", "monitoring_results", "monitoring_seen_items", "monitoring_jobs", "monitoring_tasks", "search_cache"]) await t.client.unsafe(`delete from ${tbl}`);
});

describe("droits de stockage Brave : lecture de la configuration", () => {
  it("jamais présumés : seule la valeur exacte « granted » les active", () => {
    expect(braveStorageRightsFromEnv({})).toBe("none");
    for (const v of ["", "true", "yes", "1", "GRANTED", " granted", "grant"]) expect(braveStorageRightsFromEnv({ WAVERTI_BRAVE_STORAGE_RIGHTS: v })).toBe("none");
    expect(braveStorageRightsFromEnv({ WAVERTI_BRAVE_STORAGE_RIGHTS: "granted" })).toBe("granted");
  });
  it("le masquage d'un constat ne garde que classification, niveau de source, empreinte et motifs génériques", () => {
    const r = redactFinding(finding as never);
    expect(r).toMatchObject({ url: null, redacted: true, title: "", snippet: "", domain: "", publishedAt: null, extractedDate: null, classification: "confirmed", sourceTier: "official", fingerprint: finding.fingerprint });
    expect(JSON.stringify(r)).not.toMatch(/editeur|Aurora|Communiqué|2027|https/);
  });
});

describe("neutralisation de l'existant (sans droits de stockage)", () => {
  it("dry-run : compte sans rien modifier", async () => {
    await seed();
    const c = await enforceBraveStoragePolicy(t.db, "none", { dryRun: true, scrubHistory: true });
    expect(c).toEqual({ searchCacheRows: 2, seenItemsScrubbed: 1, resultsScrubbed: 1, notificationsScrubbed: 1, emailsScrubbed: 1 });
    expect(await t.client`select count(*)::int as n from search_cache`).toEqual([{ n: 3 }]);
    expect((await t.client`select url from monitoring_seen_items where url <> ''`).length).toBe(2);
  });

  it("supprime les caches Brave, vide adresse et titre des éléments vus, masque l'historique des recherches de sujets", async () => {
    const s = await seed();
    const c = await enforceBraveStoragePolicy(t.db, "none");
    expect(c).toMatchObject({ searchCacheRows: 2, seenItemsScrubbed: 1, resultsScrubbed: 1, notificationsScrubbed: 0, emailsScrubbed: 0 });
    // caches : seuls les caches Brave disparaissent
    expect(await t.client<{ provider: string }[]>`select provider from search_cache`).toEqual([{ provider: "autre" }]);
    // éléments vus : empreinte conservée, contenu vidé ; surveillance de page intacte
    const seen = await t.client<{ task_id: string; url: string; title: string | null; fingerprint: string }[]>`select task_id, url, title, fingerprint from monitoring_seen_items order by fingerprint`;
    expect(seen.find((x) => x.task_id === s.web.task)).toMatchObject({ url: "", title: null, fingerprint: "f".repeat(40) });
    expect(seen.find((x) => x.task_id === s.page.task)).toMatchObject({ url: "https://boutique.example/p", title: "Fiche" });
    // historique : constats masqués, page intacte
    const [w] = await t.client<{ observation: { findings: Array<Record<string, unknown>> }; change_summary: unknown }[]>`select observation, change_summary from monitoring_results where task_id = ${s.web.task}`;
    expect(w!.observation.findings).toHaveLength(1);
    expect(w!.observation.findings[0]).toMatchObject({ url: null, redacted: true, title: "", snippet: "", domain: "", classification: "confirmed", fingerprint: finding.fingerprint });
    expect(JSON.stringify(w)).not.toMatch(/editeur|Aurora|Communiqué|https/);
    expect(w!.change_summary).toEqual({ redacted: true });
    const [p] = await t.client<{ observation: { price: number; finalUrl: string }; change_summary: { priceFrom: number } }[]>`select observation, change_summary from monitoring_results where task_id = ${s.page.task}`;
    expect(p).toMatchObject({ observation: { price: 49.9, finalUrl: "https://boutique.example/p" }, change_summary: { priceFrom: 59.9 } });
    // alertes et e-mails : intacts tant que l'étape d'historique n'est pas demandée
    expect((await t.client`select title from notifications where type = 'web_topic'`)[0]).toMatchObject({ title: "Confirmé : Projet Aurora le 14 mars" });
  });

  it("avec l'étape d'historique : alertes et e-mails de recherche de sujets rendus génériques, les autres alertes intactes", async () => {
    await seed();
    const c = await enforceBraveStoragePolicy(t.db, "none", { scrubHistory: true });
    expect(c.notificationsScrubbed).toBe(1);
    expect(c.emailsScrubbed).toBe(1);
    const n = await t.client<{ type: string; title: string; body: string; source_url: string | null }[]>`select type, title, body, source_url from notifications order by type`;
    expect(n.find((x) => x.type === "web_topic")).toMatchObject({ title: "Nouvelle information détectée", source_url: null });
    expect(JSON.stringify(n.find((x) => x.type === "web_topic"))).not.toMatch(/Aurora|editeur/);
    expect(n.find((x) => x.type === "price")).toMatchObject({ title: "Prix en baisse", source_url: "https://boutique.example/p" });
    const [e] = await t.client<{ subject: string; payload: unknown }[]>`select subject, payload from email_outbox`;
    expect(e).toEqual({ subject: "Nouvelle information détectée", payload: { redacted: true } });
  });

  it("idempotent ; avec droits confirmés, ne touche à rien", async () => {
    await seed();
    await enforceBraveStoragePolicy(t.db, "none", { scrubHistory: true });
    expect(await enforceBraveStoragePolicy(t.db, "none", { scrubHistory: true })).toEqual({ searchCacheRows: 0, seenItemsScrubbed: 0, resultsScrubbed: 0, notificationsScrubbed: 0, emailsScrubbed: 0 });
    await seed();
    expect(await enforceBraveStoragePolicy(t.db, "granted", { scrubHistory: true })).toEqual({ searchCacheRows: 0, seenItemsScrubbed: 0, resultsScrubbed: 0, notificationsScrubbed: 0, emailsScrubbed: 0 });
    expect((await t.client`select count(*)::int as n from search_cache where provider = 'brave'`)[0]).toEqual({ n: 1 });
  });
});
