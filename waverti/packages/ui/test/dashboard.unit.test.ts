import { describe, expect, it } from "vitest";
import type { OverviewData } from "@waverti/types";
import { activityEntries, attentionItems } from "../src/app/dashboard";

const NOW = new Date("2026-11-02T10:00:00Z");
const base = (over: Partial<OverviewData> = {}): OverviewData => ({
  activeMonitors: 2,
  alertsLast7Days: 0,
  upcoming: [],
  latestResults: [],
  recentAlerts: [],
  devices: [],
  subscription: { planId: "pro", planName: "Pro", status: "active", isTrial: false, trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
  quotas: [],
  ...over,
});
const hrefs = { alerts: "/a", subscription: "/s", monitor: (id: string) => `/m/${id}` };
const alert = (id: string, priority: "normal" | "high" | "critical", read: string | null = null) => ({
  id, type: "price", priority, title: `Alerte ${id}`, body: "", taskName: "Casque", sourceUrl: null, linkPath: null, createdAt: "2026-11-02T09:00:00Z", readAt: read,
});
const result = (id: string, outcome: "ok" | "changed" | "triggered" | "error", at = "2026-11-02T09:30:00Z") => ({
  id, checkedAt: at, outcome, executedBy: "cloud" as const, summary: "Résumé", value: null, sourceUrl: null, monitorId: `m${id}`, monitorName: `Page ${id}`,
});

describe("tableau de bord — « Nécessite votre attention »", () => {
  it("ne signale rien quand tout va bien", () => {
    expect(attentionItems(base(), hrefs, true, NOW)).toEqual([]);
  });
  it("signale un paiement échoué en priorité, avec une action", () => {
    const [a] = attentionItems(base({ subscription: { ...base().subscription, status: "past_due" } }), hrefs, true, NOW);
    expect(a).toMatchObject({ tone: "danger", href: "/s" });
  });
  it("signale l'absence de formule, sauf accès bêta", () => {
    const none = { ...base().subscription, planId: null, planName: null, status: null };
    expect(attentionItems(base({ subscription: none }), hrefs, true, NOW)[0]?.key).toBe("nosub");
    expect(attentionItems(base({ subscription: { ...none, betaEndsAt: "2026-12-01T00:00:00Z" } }), hrefs, true, NOW)).toEqual([]);
  });
  it("distingue alertes importantes et alertes simplement non lues", () => {
    const items = attentionItems(base({ recentAlerts: [alert("1", "critical"), alert("2", "normal"), alert("3", "normal"), alert("4", "high", "2026-11-02T09:10:00Z")] }), hrefs, true, NOW);
    expect(items.map((i) => i.key)).toEqual(["alert-1", "unread"]);
    expect(items[1]?.title).toBe("2 alertes n'ont pas encore été lues");
  });
  it("signale les vérifications en échec (une fois par surveillance) et les quotas presque atteints", () => {
    const items = attentionItems(base({ latestResults: [result("1", "error"), result("1", "error", "2026-11-02T08:00:00Z")], quotas: [{ key: "q", label: "Surveillances", used: 9, limit: 10 }] }), hrefs, true, NOW);
    expect(items.map((i) => i.key)).toEqual(["err-m1", "quota-q"]);
  });
});

describe("tableau de bord — activité récente", () => {
  it("limite les « rien de nouveau » à 3 et trie du plus récent au plus ancien", () => {
    const results = ["1", "2", "3", "4", "5"].map((i, n) => result(i, "ok", `2026-11-02T09:0${n}:00Z`));
    const e = activityEntries(base({ latestResults: results }), (id) => `/m/${id}`, "/a");
    expect(e).toHaveLength(3);
    expect(new Date(e[0]!.at).getTime()).toBeGreaterThanOrEqual(new Date(e[1]!.at).getTime());
  });
  it("ne répète pas un changement déjà annoncé par une alerte", () => {
    const e = activityEntries(base({ recentAlerts: [alert("1", "normal")], latestResults: [{ ...result("9", "triggered", "2026-11-02T09:00:30Z"), monitorName: "Casque" }] }), (id) => `/m/${id}`, "/a");
    expect(e).toHaveLength(1);
    expect(e[0]?.text).toBe("Alerte 1");
  });
  it("écrit des phrases lisibles", () => {
    const e = activityEntries(base({ latestResults: [result("1", "changed"), result("2", "error")] }), (id) => `/m/${id}`, "/a");
    expect(e.map((x) => x.text).sort()).toEqual(["Changement détecté sur « Page 1 »", "« Page 2 » n'a pas pu être vérifiée"].sort());
  });
});
