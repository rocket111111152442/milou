import { describe, expect, it } from "vitest";
import { PLAN_CATALOG } from "../src/catalog";
import { computeEntitlements, roleForEntitlements, type PlanRow } from "../src/entitlements";
import { checkNewMonitor, planQuotaEnforcement, QuotaError, resolveSettings, checkNewSite } from "../src/quotas";

const plans = new Map<string, PlanRow>(Object.values(PLAN_CATALOG).map((p) => [p.id, p]));
const now = new Date("2026-11-01T12:00:00Z");
const day = 86_400_000;

describe("computeEntitlements", () => {
  it("gives the free plan without subscription", () => {
    const e = computeEntitlements(plans, null, now);
    expect(e).toMatchObject({ planId: "discovery", source: "free", maxMonitors: 3, cloudRelay: false, emailAlerts: false });
  });

  it("applies trial restrictions (3 monitors, 1 topic, 1 business site) until trial end", () => {
    const e = computeEntitlements(
      plans,
      { planId: "business", status: "trialing", extraSites: 2, trialEnd: new Date(now.getTime() + day), currentPeriodEnd: null },
      now,
    );
    expect(e).toMatchObject({ planId: "business", source: "trial", maxMonitors: 3, maxWebTopics: 1, businessSites: 1, dailySearchCalls: 3 });
  });

  it("falls back to free when a trial ended long ago without Stripe confirmation", () => {
    const e = computeEntitlements(
      plans,
      { planId: "pro", status: "trialing", extraSites: 0, trialEnd: new Date(now.getTime() - day), currentPeriodEnd: null },
      now,
    );
    expect(e.planId).toBe("discovery");
  });

  it("gives full quotas when active, with extra business sites", () => {
    const pro = computeEntitlements(plans, { planId: "pro", status: "active", extraSites: 0, trialEnd: null, currentPeriodEnd: new Date(now.getTime() + 20 * day) }, now);
    expect(pro).toMatchObject({ maxMonitors: 100, maxWebTopics: 15, pageIntervalMinutes: 120, businessSites: 0 });
    const biz = computeEntitlements(plans, { planId: "business", status: "active", extraSites: 2, trialEnd: null, currentPeriodEnd: new Date(now.getTime() + 20 * day) }, now);
    expect(biz.businessSites).toBe(3);
    // Les sites supplémentaires ne s'appliquent pas hors Business
    const plus = computeEntitlements(plans, { planId: "plus", status: "active", extraSites: 5, trialEnd: null, currentPeriodEnd: new Date(now.getTime() + 20 * day) }, now);
    expect(plus.businessSites).toBe(0);
  });

  it("keeps features during a 7-day past_due grace period, then drops to free", () => {
    const end = new Date(now.getTime() - 2 * day);
    expect(computeEntitlements(plans, { planId: "plus", status: "past_due", extraSites: 0, trialEnd: null, currentPeriodEnd: end }, now).source).toBe("grace");
    const old = new Date(now.getTime() - 9 * day);
    expect(computeEntitlements(plans, { planId: "plus", status: "past_due", extraSites: 0, trialEnd: null, currentPeriodEnd: old }, now).planId).toBe("discovery");
  });

  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const)("gives no paid feature when %s", (status) => {
    const e = computeEntitlements(plans, { planId: "pro", status, extraSites: 0, trialEnd: null, currentPeriodEnd: new Date(now.getTime() + day) }, now);
    expect(e.planId).toBe("discovery");
  });

  it("derives the business role but never touches admin", () => {
    const biz = computeEntitlements(plans, { planId: "business", status: "active", extraSites: 0, trialEnd: null, currentPeriodEnd: new Date(now.getTime() + day) }, now);
    expect(roleForEntitlements("user", biz)).toBe("business");
    expect(roleForEntitlements("admin", biz)).toBe("admin");
    expect(roleForEntitlements("business", computeEntitlements(plans, null, now))).toBe("user");
  });
});

describe("quotas", () => {
  const free = computeEntitlements(plans, null, now);
  const plus = computeEntitlements(plans, { planId: "plus", status: "active", extraSites: 0, trialEnd: null, currentPeriodEnd: new Date(now.getTime() + day) }, now);

  it("rejects monitors beyond the plan limit", () => {
    expect(() => checkNewMonitor(free, { total: 3, webTopics: 0 }, { kind: "page" })).toThrow(QuotaError);
    expect(checkNewMonitor(free, { total: 2, webTopics: 0 }, { kind: "page" })).toEqual({ intervalMinutes: 720, executionMode: "local_only" });
  });

  it("rejects web topics on the free plan and beyond the topic quota", () => {
    expect(() => checkNewMonitor(free, { total: 0, webTopics: 0 }, { kind: "web_topic" })).toThrow(/n'est pas incluse/);
    expect(() => checkNewMonitor(plus, { total: 5, webTopics: 3 }, { kind: "web_topic" })).toThrow(/3 sujet/);
  });

  it("refuses intervals shorter than the plan allows (quota manipulation)", () => {
    expect(() => resolveSettings(plus, { kind: "page", intervalMinutes: 5 })).toThrow(/fréquence minimale/);
    expect(resolveSettings(plus, { kind: "page", intervalMinutes: 720 }).intervalMinutes).toBe(720);
  });

  it("forces web topics to run in the cloud and free monitors to run locally", () => {
    expect(resolveSettings(plus, { kind: "web_topic", executionMode: "local_only" }).executionMode).toBe("cloud_only");
    expect(resolveSettings(free, { kind: "page", executionMode: "cloud_only" }).executionMode).toBe("local_only");
  });

  it("requires Business for professional sites", () => {
    expect(() => checkNewSite(plus, 0)).toThrow(/Business/);
  });

  it("pauses the newest monitors above quota and resumes them when quota grows", () => {
    const monitors = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`,
      kind: (i === 5 ? "web_topic" : "page") as "page" | "web_topic",
      status: "active",
      createdAt: new Date(now.getTime() + i * 1000),
    }));
    const down = planQuotaEnforcement(free, monitors);
    expect(down.pause).toEqual(["m3", "m4", "m5"]);
    const paused = monitors.map((m) => ({ ...m, status: down.pause.includes(m.id) ? "paused_quota" : m.status }));
    const up = planQuotaEnforcement(plus, paused);
    expect(up.resume.sort()).toEqual(["m3", "m4", "m5"]);
    expect(up.pause).toEqual([]);
  });
});
