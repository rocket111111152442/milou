import { describe, expect, it } from "vitest";
import { PAID_PLAN_IDS, PLAN_CATALOG } from "../src/catalog";
import { computeEntitlements, roleForEntitlements, type PlanRow } from "../src/entitlements";
import { checkNewMonitor, checkNewScenario, checkNewSite, planQuotaEnforcement, QuotaError, resolveSettings } from "../src/quotas";

const plans = new Map<string, PlanRow>(Object.values(PLAN_CATALOG).map((p) => [p.id, p]));
const now = new Date("2026-11-01T12:00:00Z");
const day = 86_400_000;
const active = (planId: string, extraSites = 0) =>
  computeEntitlements(plans, { planId, status: "active", extraSites, trialEnd: null, currentPeriodEnd: new Date(now.getTime() + 20 * day) }, now);
const trial = (planId: string) =>
  computeEntitlements(plans, { planId, status: "trialing", extraSites: 0, trialEnd: new Date(now.getTime() + day), currentPeriodEnd: null }, now);

describe("catalogue des formules", () => {
  it("ne propose que des formules payantes, avec un essai de 72 h", () => {
    expect(PAID_PLAN_IDS).toEqual(["plus", "pro", "max", "business"]);
    for (const p of Object.values(PLAN_CATALOG)) {
      expect(p.priceCents).toBeGreaterThan(0);
      expect(p.trialHours).toBe(72);
    }
    expect(Object.keys(PLAN_CATALOG)).not.toContain("discovery");
  });

  it("applique la grille validée (prix, surveillances, sujets, fréquences, e-mails, recherches)", () => {
    const grid = Object.values(PLAN_CATALOG).map((p) => [
      p.id,
      p.priceCents,
      p.maxMonitors,
      p.maxWebTopics,
      p.pageIntervalMinutes,
      1440 / (p.webIntervalMinutes ?? 1440),
      p.monthlyEmailAlerts,
      p.monthlySearchCalls,
      p.businessSitesIncluded,
    ]);
    expect(grid).toEqual([
      ["plus", 599, 20, 3, 360, 1, 30, 90, 0],
      ["pro", 1499, 100, 10, 120, 2, 80, 600, 0],
      ["max", 2999, 150, 20, 60, 2, 150, 1200, 0],
      ["business", 3999, 100, 10, 120, 2, 150, 600, 1],
    ]);
  });

  it("dimensionne les recherches mensuelles pour un usage à 100 % des sujets", () => {
    for (const p of Object.values(PLAN_CATALOG)) {
      const perDay = 1440 / (p.webIntervalMinutes ?? 1440);
      expect(p.monthlySearchCalls).toBe(p.maxWebTopics * perDay * 30);
    }
  });

  it("Business hérite des limites Pro (hors alertes e-mail et fonctions professionnelles)", () => {
    const { pro, business } = PLAN_CATALOG;
    for (const k of ["maxMonitors", "maxWebTopics", "pageIntervalMinutes", "webIntervalMinutes", "historyDays", "advancedHistory", "dataExports", "monthlySearchCalls"] as const) {
      expect(business[k]).toBe(pro[k]);
    }
  });
});

describe("computeEntitlements", () => {
  it("n'accorde aucun droit sans abonnement (pas de formule gratuite)", () => {
    const e = computeEntitlements(plans, null, now);
    expect(e).toMatchObject({ planId: null, source: "none", maxMonitors: 0, maxWebTopics: 0, cloudRelay: false, emailAlerts: false, monthlyEmailAlerts: 0, businessSites: 0 });
  });

  it("applique les restrictions d'essai (3 surveillances, 1 sujet une fois par jour, 1 site Business)", () => {
    for (const id of PAID_PLAN_IDS) {
      const e = trial(id);
      expect(e).toMatchObject({ planId: id, source: "trial", maxMonitors: 3, maxWebTopics: 1, dailySearchCalls: 2, webIntervalMinutes: 1440 });
      expect(e.monthlySearchCalls).toBeLessThanOrEqual(6);
      expect(e.monthlyEmailAlerts).toBeLessThanOrEqual(10);
    }
    expect(trial("business")).toMatchObject({ businessSites: 1, businessScenarios: 1 });
  });

  it("aucun droit si l'essai est terminé depuis longtemps sans confirmation de Stripe", () => {
    const e = computeEntitlements(
      plans,
      { planId: "pro", status: "trialing", extraSites: 0, trialEnd: new Date(now.getTime() - day), currentPeriodEnd: null },
      now,
    );
    expect(e).toMatchObject({ planId: null, source: "none", maxMonitors: 0 });
  });

  it("quotas complets une fois l'abonnement actif", () => {
    expect(active("plus")).toMatchObject({ maxMonitors: 20, maxWebTopics: 3, pageIntervalMinutes: 360, monthlyEmailAlerts: 30, monthlySearchCalls: 90 });
    expect(active("pro")).toMatchObject({ maxMonitors: 100, maxWebTopics: 10, pageIntervalMinutes: 120, monthlyEmailAlerts: 80, monthlySearchCalls: 600 });
    expect(active("max")).toMatchObject({ maxMonitors: 150, maxWebTopics: 20, pageIntervalMinutes: 60, monthlyEmailAlerts: 150, monthlySearchCalls: 1200, businessSites: 0 });
    expect(active("business")).toMatchObject({ maxMonitors: 100, maxWebTopics: 10, monthlyEmailAlerts: 150, businessSites: 1, businessScenarios: 1 });
  });

  it("option site supplémentaire abandonnée : une ancienne quantité éventuelle n'ouvre aucun droit", () => {
    const biz = active("business", 2);
    expect(biz.businessSites).toBe(1);
    expect(biz.businessScenarios).toBe(1);
    expect(active("max", 5).businessSites).toBe(0);
  });

  it("garde les droits 7 jours en cas d'impayé, puis plus aucun", () => {
    const end = new Date(now.getTime() - 2 * day);
    expect(computeEntitlements(plans, { planId: "plus", status: "past_due", extraSites: 0, trialEnd: null, currentPeriodEnd: end }, now).source).toBe("grace");
    const old = new Date(now.getTime() - 9 * day);
    expect(computeEntitlements(plans, { planId: "plus", status: "past_due", extraSites: 0, trialEnd: null, currentPeriodEnd: old }, now).planId).toBeNull();
  });

  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const)("aucun droit quand %s", (status) => {
    const e = computeEntitlements(plans, { planId: "pro", status, extraSites: 0, trialEnd: null, currentPeriodEnd: new Date(now.getTime() + day) }, now);
    expect(e).toMatchObject({ planId: null, source: "none", maxMonitors: 0 });
  });

  it("dérive le rôle business sans jamais toucher au rôle admin", () => {
    const biz = active("business");
    expect(roleForEntitlements("user", biz)).toBe("business");
    expect(roleForEntitlements("admin", biz)).toBe("admin");
    expect(roleForEntitlements("business", computeEntitlements(plans, null, now))).toBe("user");
  });
});

describe("quotas", () => {
  const none = computeEntitlements(plans, null, now);
  const plus = active("plus");

  it("refuse toute surveillance sans abonnement ni essai", () => {
    expect(() => checkNewMonitor(none, { total: 0, webTopics: 0 }, { kind: "page" })).toThrow(/essai gratuit de 3 jours/);
    expect(() => checkNewSite(none, 0)).toThrow(QuotaError);
  });

  it("refuse les surveillances au-delà de la formule", () => {
    expect(() => checkNewMonitor(plus, { total: 20, webTopics: 0 }, { kind: "page" })).toThrow(/20 surveillance/);
    expect(checkNewMonitor(plus, { total: 19, webTopics: 0 }, { kind: "page" })).toEqual({ intervalMinutes: 360, executionMode: "auto" });
    expect(() => checkNewMonitor(trial("max"), { total: 3, webTopics: 0 }, { kind: "page" })).toThrow(/3 surveillance/);
  });

  it("refuse les sujets au-delà du quota (Pro : 10)", () => {
    expect(() => checkNewMonitor(plus, { total: 5, webTopics: 3 }, { kind: "web_topic" })).toThrow(/3 sujet/);
    expect(() => checkNewMonitor(active("pro"), { total: 5, webTopics: 10 }, { kind: "web_topic" })).toThrow(/10 sujet/);
    expect(checkNewMonitor(active("max"), { total: 5, webTopics: 19 }, { kind: "web_topic" }).intervalMinutes).toBe(720);
  });

  it("refuse les fréquences plus courtes que la formule (manipulation de quota)", () => {
    expect(() => resolveSettings(plus, { kind: "page", intervalMinutes: 5 })).toThrow(/fréquence minimale/);
    expect(resolveSettings(plus, { kind: "page", intervalMinutes: 720 }).intervalMinutes).toBe(720);
    expect(resolveSettings(active("max"), { kind: "page" }).intervalMinutes).toBe(60);
    // Essai : recherche au plus une fois par jour, même en Pro.
    expect(() => resolveSettings(trial("pro"), { kind: "web_topic", intervalMinutes: 720 })).toThrow(/fréquence minimale/);
  });

  it("les sujets Web s'exécutent toujours côté serveurs", () => {
    expect(resolveSettings(plus, { kind: "web_topic", executionMode: "local_only" }).executionMode).toBe("cloud_only");
  });

  it("le site professionnel exige Business", () => {
    expect(() => checkNewSite(active("max"), 0)).toThrow(/Business/);
    expect(() => checkNewSite(active("business"), 1)).toThrow(/1 site/);
    expect(() => checkNewSite(active("business", 1), 1)).toThrow(/1 site/);
  });

  it("un seul scénario navigateur au total", () => {
    const biz = active("business");
    expect(() => checkNewScenario(biz, 0, 0)).not.toThrow();
    expect(() => checkNewScenario(biz, 0, 1)).toThrow(/1 scénario/);
    expect(() => checkNewScenario(biz, 1, 1)).toThrow(/par site/);
  });

  it("à la fin de l'abonnement, toutes les surveillances sont mises en pause puis reprises au retour", () => {
    const monitors = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`,
      kind: (i === 5 ? "web_topic" : "page") as "page" | "web_topic",
      status: "active",
      createdAt: new Date(now.getTime() + i * 1000),
    }));
    const down = planQuotaEnforcement(none, monitors);
    expect(down.pause).toEqual(["m0", "m1", "m2", "m3", "m4", "m5"]);
    const paused = monitors.map((m) => ({ ...m, status: "paused_quota" }));
    const trialing = planQuotaEnforcement(trial("plus"), paused);
    expect(trialing.resume).toEqual(["m0", "m1", "m2"]);
    const up = planQuotaEnforcement(plus, paused);
    expect(up.resume.sort()).toEqual(["m0", "m1", "m2", "m3", "m4", "m5"]);
  });
});
