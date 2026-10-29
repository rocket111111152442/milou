import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { buildQueries, detectIntent, planWebTopic, suggestSubject, wantsOfficial } from "../src/search/planner";
import { classifyResult, extractDate, meetsThreshold, sourceTier, topicStatus } from "../src/search/classify";
import { createBraveProvider, SearchProviderError } from "../src/search/brave";

const cond = (over = {}) => ({ type: "web_topic" as const, intent: "release_date" as const, subject: "Projet Aurora", keywords: [], requireOfficial: true, ...over });
const item = (hostname: string, title: string, description = "") => ({ url: `https://${hostname}/article`, title, description, age: null, publishedAt: null, hostname });

describe("planner (deterministic request understanding)", () => {
  it("detects intents in French requests", () => {
    expect(detectIntent("Préviens-moi dès que la date de sortie officielle de Projet Aurora est annoncée")).toBe("release_date");
    expect(detectIntent("Nouvelle offre de stage en design produit à Lyon")).toBe("job_offer");
    expect(detectIntent("Publication du décret sur les retraites")).toBe("official_publication");
    expect(detectIntent("Annonce d'un nouveau produit Apple")).toBe("announcement");
    expect(detectIntent("Actualités sur la mairie")).toBe("generic");
  });

  it("detects the official requirement and proposes a subject", () => {
    expect(wantsOfficial("la date officielle")).toBe(true);
    expect(wantsOfficial("une rumeur")).toBe(false);
    expect(suggestSubject("Préviens-moi dès que la date de sortie officielle de « Projet Aurora » est annoncée")).toBe("Projet Aurora");
    expect(suggestSubject("Préviens-moi dès que la date de sortie officielle de Hollow Knight Silksong est annoncée")).toBe("Hollow Knight Silksong");
  });

  it("builds a small set of queries, official domains first", () => {
    const q = buildQueries(cond(), ["editeur.example"]);
    expect(q[0]).toBe("site:editeur.example Projet Aurora");
    expect(q.length).toBeLessThanOrEqual(5);
    const plan = planWebTopic("Offres de stage chez Acme", { subject: "Acme" });
    expect(plan.condition).toMatchObject({ intent: "job_offer", subject: "Acme", requireOfficial: false });
  });
});

describe("classification", () => {
  it("tiers sources", () => {
    expect(sourceTier("editeur.example", ["editeur.example"], "x")).toBe("official");
    expect(sourceTier("www.legifrance.gouv.fr", [], "x")).toBe("official");
    expect(sourceTier("fr.wikipedia.org", [], "x")).toBe("reference");
    expect(sourceTier("www.reddit.com", [], "x")).toBe("community");
    expect(sourceTier("numerama.com", [], "x")).toBe("media");
    expect(sourceTier("aurora.example", [], "Projet Aurora")).toBe("reference");
    expect(sourceTier("blog-random.example", [], "x")).toBe("unknown");
  });

  it("extracts French dates", () => {
    expect(extractDate("Sortie le 14 mars 2027 sur consoles")).toBe("14 mars 2027");
    expect(extractDate("prévu pour le printemps 2027")).toBe("printemps 2027");
    expect(extractDate("aucune date")).toBeNull();
  });

  it("classifies official, media, rumor and irrelevant results", () => {
    const official = classifyResult(item("editeur.example", "Projet Aurora sortira le 14 mars 2027", "Communiqué officiel"), cond(), ["editeur.example"]);
    expect(official).toMatchObject({ classification: "confirmed", sourceTier: "official", extractedDate: "14 mars 2027" });
    const media = classifyResult(item("numerama.com", "Projet Aurora : sortie en mars 2027 ?", "Le studio vise mars 2027"), cond(), []);
    expect(media.classification).toBe("probable");
    const rumor = classifyResult(item("numerama.com", "Projet Aurora sortirait en mars 2027 selon des sources", "fuite"), cond(), []);
    expect(rumor.classification).toBe("rumor");
    const forum = classifyResult(item("forum-jeux.example", "Projet Aurora le 14 mars 2027 !!!", ""), cond(), []);
    expect(forum.classification).toBe("rumor");
    const noDate = classifyResult(item("editeur.example", "Projet Aurora : nouvelles images", ""), cond(), ["editeur.example"]);
    expect(noDate.classification).toBe("irrelevant");
    const offTopic = classifyResult(item("numerama.com", "Un autre jeu sort le 2 mai 2027", ""), cond(), []);
    expect(offTopic.classification).toBe("irrelevant");
  });

  it("deduplicates the same dated claim across sites and applies thresholds", () => {
    const a = classifyResult(item("numerama.com", "Projet Aurora en mars 2027", "Le studio vise mars 2027"), cond(), []);
    const b = classifyResult(item("ign.com", "Projet Aurora : mars 2027", "Sortie visée en mars 2027"), cond(), []);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(meetsThreshold("probable", true)).toBe(false);
    expect(meetsThreshold("confirmed", true)).toBe(true);
    expect(meetsThreshold("probable", false)).toBe(true);
    expect(meetsThreshold("rumor", false)).toBe(false);
    expect(topicStatus([a])).toBe("probable");
    expect(topicStatus([])).toBe("none");
  });
});

describe("Brave client", () => {
  it("sends the key server-side and parses results", async () => {
    const seen: Record<string, string | undefined> = {};
    const server = createServer((req, res) => {
      seen.token = req.headers["x-subscription-token"] as string;
      seen.url = req.url;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ web: { results: [{ url: "https://www.numerama.com/a", title: "<strong>Projet</strong> Aurora", description: "Sortie &amp; date", meta_url: { hostname: "www.numerama.com" } }, { url: "javascript:alert(1)", title: "x" }] } }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as { port: number }).port;
    const brave = createBraveProvider("key-123", `http://127.0.0.1:${port}`);
    const items = await brave.search("Projet Aurora date de sortie");
    expect(seen.token).toBe("key-123");
    expect(seen.url).toContain("country=FR");
    expect(items).toEqual([{ url: "https://www.numerama.com/a", title: "Projet Aurora", description: "Sortie & date", age: null, publishedAt: null, hostname: "numerama.com" }]);
    server.close();
  });

  it("marks rate limits as retryable", async () => {
    const brave = createBraveProvider("k", "http://unused", (async () => new Response("", { status: 429 })) as typeof fetch);
    await expect(brave.search("x")).rejects.toMatchObject({ retryable: true });
    await expect(brave.search("x")).rejects.toBeInstanceOf(SearchProviderError);
  });
});
