import { describe, expect, it } from "vitest";
import { PLAN_CATALOG, scaledMonthlyLimit, searchQuotaWindow } from "../src";

const sub = (start: string, end: string) => ({ currentPeriodStart: new Date(start), currentPeriodEnd: new Date(end) });
const ent = (monthly: number, source: "subscription" | "trial" | "grace" | "none" = "subscription", daily: number | null = null) => ({
  source,
  monthlySearchCalls: monthly,
  dailySearchCalls: daily,
});

describe("quota de recherches selon les jours de la période", () => {
  it("référence de 30 jours = valeurs affichées", () => {
    expect(PLAN_CATALOG.plus.monthlySearchCalls).toBe(90);
    expect(PLAN_CATALOG.pro.monthlySearchCalls).toBe(600);
    expect(PLAN_CATALOG.max.monthlySearchCalls).toBe(1200);
    expect(PLAN_CATALOG.business.monthlySearchCalls).toBe(600);
  });

  it.each([
    [28, [84, 560, 1120, 560]],
    [29, [87, 580, 1160, 580]],
    [30, [90, 600, 1200, 600]],
    [31, [93, 620, 1240, 620]],
  ])("%i jours", (days, expected) => {
    const got = (["plus", "pro", "max", "business"] as const).map((p) => scaledMonthlyLimit(PLAN_CATALOG[p].monthlySearchCalls, days));
    expect(got).toEqual(expected);
  });

  it("utilise la période facturée Stripe (renouvellement en milieu de mois)", () => {
    // 15 janvier → 15 février : 31 jours.
    const w = searchQuotaWindow(ent(600), sub("2027-01-15T10:00:00Z", "2027-02-15T10:00:00Z"), new Date("2027-02-01T00:00:00Z"));
    expect(w).toMatchObject({ period: "bp:2027-01-15", days: 31, limit: 620, dailyLimit: null });
    // 15 février → 15 mars 2027 : 28 jours.
    const f = searchQuotaWindow(ent(600), sub("2027-02-15T10:00:00Z", "2027-03-15T10:00:00Z"), new Date("2027-03-01T00:00:00Z"));
    expect(f).toMatchObject({ period: "bp:2027-02-15", days: 28, limit: 560 });
    // Année bissextile : 15 février → 15 mars 2028 = 29 jours.
    const l = searchQuotaWindow(ent(90), sub("2028-02-15T10:00:00Z", "2028-03-15T10:00:00Z"), new Date("2028-03-01T00:00:00Z"));
    expect(l).toMatchObject({ days: 29, limit: 87 });
  });

  it("renouvellement : nouvelle période = nouveau compteur", () => {
    const a = searchQuotaWindow(ent(1200), sub("2027-01-15T10:00:00Z", "2027-02-15T10:00:00Z"), new Date("2027-02-15T09:59:00Z"));
    const b = searchQuotaWindow(ent(1200), sub("2027-02-15T10:00:00Z", "2027-03-15T10:00:00Z"), new Date("2027-02-15T10:01:00Z"));
    expect(a.period).not.toBe(b.period);
  });

  it("changement de formule en cours de période : même compteur, nouveau plafond", () => {
    const period = sub("2027-01-15T10:00:00Z", "2027-02-15T10:00:00Z");
    const now = new Date("2027-01-20T00:00:00Z");
    const before = searchQuotaWindow(ent(90), period, now);
    const after = searchQuotaWindow(ent(600), period, now);
    expect(after.period).toBe(before.period);
    expect([before.limit, after.limit]).toEqual([93, 620]);
  });

  it("sans période connue (ou dates incohérentes) : mois civil UTC", () => {
    expect(searchQuotaWindow(ent(600), null, new Date("2026-10-31T12:00:00Z"))).toMatchObject({ period: "2026-10", days: 31, limit: 620 });
    expect(searchQuotaWindow(ent(600), null, new Date("2026-11-10T12:00:00Z"))).toMatchObject({ period: "2026-11", days: 30, limit: 600 });
    expect(searchQuotaWindow(ent(90), null, new Date("2027-02-10T12:00:00Z"))).toMatchObject({ days: 28, limit: 84 });
    // Période expirée (webhook de renouvellement en retard) : repli sur le mois civil, jamais de blocage.
    expect(searchQuotaWindow(ent(600), sub("2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z"), new Date("2026-10-02T00:00:00Z")).period).toBe("2026-10");
  });

  it("essai : plafond de l'essai, non proratisé ; sans droit : zéro", () => {
    const t = searchQuotaWindow(ent(6, "trial", 2), sub("2026-10-30T00:00:00Z", "2026-11-02T00:00:00Z"), new Date("2026-10-31T00:00:00Z"));
    expect(t).toMatchObject({ limit: 6, dailyLimit: 2, period: "bp:2026-10-30" });
    expect(searchQuotaWindow(ent(0, "none"), null).limit).toBe(0);
  });
});
