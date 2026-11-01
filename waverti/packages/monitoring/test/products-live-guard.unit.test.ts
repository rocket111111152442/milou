import { describe, expect, it, vi } from "vitest";
import { assertLiveTestAllowed, LiveTestRefused, runSingleBraveProbe, singleShotFetch, type ProductTarget } from "../src/products";
import { braveBody, numworksResults } from "./brave-fixtures";

// Aucun appel réseau réel : `fetch` est toujours simulé ici.
const target: ProductTarget = { identity: { brand: "NumWorks", name: "NumWorks Calculatrice graphique N0120", mpn: "N0120", gtin: "3700000000000" }, condition: "new", currency: "EUR", country: "FR" };
const okEnv = { WAVERTI_LIVE_BRAVE_TEST: "AUTHORIZED_ONE_REQUEST", BRAVE_SEARCH_API_KEY: "test-key-not-real" };
const okFetch = () => vi.fn(async () => new Response(braveBody(numworksResults((h, p = "/") => `https://${h}${p}`)), { status: 200, headers: { "content-type": "application/json" } }));

describe("test réel Brave — garde-fous", () => {
  it("refuse sans autorisation explicite, sans émettre aucun appel", async () => {
    const f = okFetch();
    await expect(runSingleBraveProbe({ env: { BRAVE_SEARCH_API_KEY: "k" }, target, fetchImpl: f as never })).rejects.toMatchObject({ code: "not_authorized" });
    await expect(runSingleBraveProbe({ env: { ...okEnv, WAVERTI_LIVE_BRAVE_TEST: "true" }, target, fetchImpl: f as never })).rejects.toMatchObject({ code: "not_authorized" });
    expect(f).not.toHaveBeenCalled();
  });
  it("refuse sans clé, ou si le coût unitaire dépasse $0.005", () => {
    expect(() => assertLiveTestAllowed({ WAVERTI_LIVE_BRAVE_TEST: "AUTHORIZED_ONE_REQUEST" })).toThrowError(LiveTestRefused);
    expect(() => assertLiveTestAllowed({ ...okEnv, WAVERTI_BRAVE_REQUEST_COST_MICROS: "5001" })).toThrowError(/budget/);
    expect(() => assertLiveTestAllowed({ ...okEnv, WAVERTI_BRAVE_REQUEST_COST_MICROS: "abc" })).toThrowError(/invalide/);
    expect(assertLiveTestAllowed({ ...okEnv, WAVERTI_BRAVE_REQUEST_COST_MICROS: "5000" }).costMicros).toBe(5000);
  });
  it("émet exactement une requête et rapporte le coût estimé", async () => {
    const f = okFetch();
    const r = await runSingleBraveProbe({ env: okEnv, target, fetchImpl: f as never });
    expect(f).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ braveRequests: 1, estimatedCostMicros: 5000, outcome: "success" });
    expect(r.rawResults).toBeGreaterThan(0);
    expect(r.kept).toBeGreaterThan(0);
    expect(r.kept).toBeLessThan(r.rawResults);
  });
  it("une réponse vide ou en échec ne déclenche JAMAIS de deuxième requête ni de nouvelle tentative", async () => {
    const empty = vi.fn(async () => new Response(braveBody([]), { status: 200 }));
    const r1 = await runSingleBraveProbe({ env: okEnv, target, fetchImpl: empty as never });
    expect(empty).toHaveBeenCalledTimes(1);
    expect(r1).toMatchObject({ braveRequests: 1, rawResults: 0, kept: 0 });
    for (const status of [429, 500, 503]) {
      const bad = vi.fn(async () => new Response("{}", { status }));
      const r = await runSingleBraveProbe({ env: okEnv, target, fetchImpl: bad as never });
      expect(bad).toHaveBeenCalledTimes(1);
      expect(r.outcome).toBe("failure");
      expect(r.braveRequests).toBe(1);
    }
  });
  it("la deuxième requête est bloquée avant le réseau", async () => {
    const f = okFetch();
    const g = singleShotFetch(f as never);
    await g.fetch("https://api.search.brave.com/x");
    expect(() => g.fetch("https://api.search.brave.com/y")).toThrowError(/une seule requête/);
    expect(f).toHaveBeenCalledTimes(1);
    expect(g.calls).toBe(1);
  });
  it("le rapport ne contient jamais la clé", async () => {
    const r = await runSingleBraveProbe({ env: okEnv, target, fetchImpl: okFetch() as never });
    expect(JSON.stringify(r)).not.toContain("test-key-not-real");
  });
});
