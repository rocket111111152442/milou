/// <reference lib="dom" />
/**
 * Scénarios navigateur Business (parcours utilisateur sur le site VÉRIFIÉ du client).
 *
 * Protections :
 * - navigation limitée au domaine vérifié (et à ses sous-domaines) ;
 * - requêtes d'écriture (POST…) bloquées hors du domaine vérifié (pas d'envoi vers des tiers) ;
 * - clic ou validation refusés sur tout élément évoquant un achat, un paiement ou une suppression ;
 * - saisie refusée dans les champs de carte bancaire et de mot de passe ;
 * - contexte de navigation neuf à chaque exécution, durée bornée.
 */
import type { Page } from "playwright";
import { artifacts, browserTestRuns, sql, type Database } from "@waverti/database";
import { BLOCKED_ACTION_KEYWORDS, scenarioStepSchema, type ScenarioStep } from "@waverti/types";
import type { BrowserPool } from "../browser/pool";
import { normalizeForMatch } from "../extract/text";
import { parseTargetUrl, type UrlPolicyOptions } from "../net/safe-url";
import { openIncident, resolveIncident } from "./incidents";
import { hostInDomain } from "./service";

export const SCENARIO_TIMEOUT_MS = 90_000;
export const SCENARIO_RETRY_DELAY_MS = 5 * 60_000;
const SCREENSHOT_RETENTION_DAYS = 30;

export class ScenarioBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioBlockedError";
  }
}

export interface StepResult {
  index: number;
  action: ScenarioStep["action"];
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface ScenarioRunResult {
  status: "passed" | "failed" | "error";
  failedStep: number | null;
  error: string | null;
  durationMs: number;
  steps: StepResult[];
  screenshot: Buffer | null;
}

const SENSITIVE_FIELD = /(cc-|card|carte|cvc|cvv|iban|password|mot.?de.?passe)/i;

function containsBlockedKeyword(text: string): string | null {
  const t = normalizeForMatch(text);
  return BLOCKED_ACTION_KEYWORDS.find((k) => t.includes(normalizeForMatch(k))) ?? null;
}

async function assertSafeClickTarget(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  const info = await el.evaluate((node) => {
    const e = node as HTMLElement & { value?: string; form?: HTMLFormElement | null };
    const form = e.closest("form");
    return {
      text: [e.innerText, e.getAttribute("aria-label"), e.getAttribute("title"), e.value, e.getAttribute("href")].filter(Boolean).join(" "),
      formAction: form?.getAttribute("action") ?? null,
      formText: form ? Array.from(form.querySelectorAll("button, input[type=submit]")).map((b) => (b as HTMLElement).innerText || (b as HTMLInputElement).value).join(" ") : "",
      isSubmit: (e.tagName === "BUTTON" && (e.getAttribute("type") ?? "submit") === "submit" && Boolean(form)) || (e.tagName === "INPUT" && e.getAttribute("type") === "submit"),
    };
  });
  const hit = containsBlockedKeyword(info.text) ?? (info.isSubmit ? containsBlockedKeyword(info.formText) : null);
  if (hit) throw new ScenarioBlockedError(`Action bloquée par sécurité : l'élément évoque « ${hit} » (achat, paiement ou suppression).`);
}

async function assertSafeField(page: Page, selector: string): Promise<void> {
  const attrs = await page
    .locator(selector)
    .first()
    .evaluate((n) => [n.getAttribute("type"), n.getAttribute("name"), n.getAttribute("id"), n.getAttribute("autocomplete")].join(" "));
  if (SENSITIVE_FIELD.test(attrs)) throw new ScenarioBlockedError("Saisie bloquée : champ de paiement ou de mot de passe.");
}

async function pressIsSafe(page: Page, selector: string, key: string): Promise<void> {
  if (key !== "Enter") return;
  const formText = await page
    .locator(selector)
    .first()
    .evaluate((n) => {
      const f = (n as HTMLElement).closest("form");
      return f ? Array.from(f.querySelectorAll("button, input[type=submit]")).map((b) => (b as HTMLElement).innerText || (b as HTMLInputElement).value).join(" ") : "";
    });
  const hit = containsBlockedKeyword(formText);
  if (hit) throw new ScenarioBlockedError(`Validation bloquée : le formulaire évoque « ${hit} ».`);
}

/** Exécute un scénario dans un contexte isolé du pool de navigateurs. */
export async function runScenario(
  pool: BrowserPool,
  scenario: { startUrl: string; steps: unknown[]; domain: string },
  policy: UrlPolicyOptions = {},
): Promise<ScenarioRunResult> {
  const started = Date.now();
  const steps: ScenarioStep[] = scenario.steps.map((s) => scenarioStepSchema.parse(s));
  const results: StepResult[] = [];
  const inDomain = (raw: string) => {
    const u = parseTargetUrl(raw, policy);
    if (!policy.allowLoopback && !hostInDomain(u.hostname, scenario.domain)) throw new ScenarioBlockedError(`Navigation hors du domaine vérifié refusée (${u.hostname}).`);
    return u.toString();
  };
  try {
    return await pool.withPage({ mutatingHosts: policy.allowLoopback ? null : [scenario.domain], blockResourceTypes: ["media"] }, SCENARIO_TIMEOUT_MS, async (page) => {
      let screenshot: Buffer | null = null;
      try {
        await page.goto(inDomain(scenario.startUrl), { waitUntil: "domcontentloaded" });
      } catch (err) {
        return { status: "failed" as const, failedStep: 0, error: `Page de départ inaccessible : ${(err as Error).message.split("\n")[0]}`, durationMs: Date.now() - started, steps: results, screenshot: await page.screenshot({ type: "jpeg", quality: 60 }).catch(() => null) };
      }
      for (const [index, step] of steps.entries()) {
        const t0 = Date.now();
        try {
          switch (step.action) {
            case "goto":
              await page.goto(inDomain(step.url), { waitUntil: "domcontentloaded" });
              break;
            case "click":
              await assertSafeClickTarget(page, step.selector);
              await page.locator(step.selector).first().click();
              await page.waitForLoadState("domcontentloaded");
              break;
            case "fill":
              await assertSafeField(page, step.selector);
              await page.locator(step.selector).first().fill(step.value);
              break;
            case "press":
              await pressIsSafe(page, step.selector, step.key);
              await page.locator(step.selector).first().press(step.key);
              await page.waitForLoadState("domcontentloaded");
              break;
            case "expect_text":
              await page.getByText(step.text, { exact: false }).first().waitFor({ state: "visible", timeout: 10_000 });
              break;
            case "expect_visible":
              await page.locator(step.selector).first().waitFor({ state: "visible", timeout: 10_000 });
              break;
            case "expect_url":
              if (!page.url().includes(step.contains)) throw new Error(`L'adresse actuelle ne contient pas « ${step.contains} ».`);
              break;
            case "wait":
              await page.waitForTimeout(step.ms);
              break;
          }
          // Une navigation provoquée par un clic ne doit pas quitter le domaine vérifié.
          inDomain(page.url());
          results.push({ index, action: step.action, ok: true, durationMs: Date.now() - t0 });
        } catch (err) {
          const blocked = err instanceof ScenarioBlockedError;
          const message = (err as Error).message.split("\n")[0]!.slice(0, 300);
          results.push({ index, action: step.action, ok: false, durationMs: Date.now() - t0, error: message });
          screenshot = await page.screenshot({ type: "jpeg", quality: 60 }).catch(() => null);
          return { status: blocked ? ("error" as const) : ("failed" as const), failedStep: index + 1, error: message, durationMs: Date.now() - started, steps: results, screenshot };
        }
      }
      return { status: "passed" as const, failedStep: null, error: null, durationMs: Date.now() - started, steps: results, screenshot: null };
    });
  } catch (err) {
    return { status: "error", failedStep: null, error: (err as Error).message === "browser_timeout" ? "Durée maximale dépassée." : "Navigateur indisponible.", durationMs: Date.now() - started, steps: results, screenshot: null };
  }
}

type DueScenario = {
  id: string;
  site_id: string;
  user_id: string;
  site_name: string;
  domain: string;
  name: string;
  start_url: string;
  steps: unknown[];
  interval_minutes: number;
  consecutive_failures: number;
};

/** Réserve et exécute les scénarios arrivés à échéance (serveurs uniquement). */
export async function runScenarioPass(
  db: Database,
  pool: BrowserPool,
  opts: { workerId: string; max: number; policy?: UrlPolicyOptions; now?: () => Date },
): Promise<number> {
  const at = opts.now?.() ?? new Date();
  const due = await db.execute<DueScenario>(sql`
    with d as (
      select sc.id from browser_test_scenarios sc
      join business_sites s on s.id = sc.site_id and s.status = 'verified'
      join entitlements en on en.user_id = sc.user_id and en.business_scenarios_per_site > 0
      join profiles p on p.id = sc.user_id and p.suspended_at is null
      where sc.enabled and sc.next_run_at <= ${at.toISOString()}::timestamptz
        and (sc.lease_expires_at is null or sc.lease_expires_at < ${at.toISOString()}::timestamptz)
      order by sc.next_run_at
      limit ${opts.max}
      for update of sc skip locked
    )
    update browser_test_scenarios sc set lease_expires_at = ${new Date(at.getTime() + 300_000).toISOString()}::timestamptz, lease_owner = ${opts.workerId}
    from d, business_sites s
    where sc.id = d.id and s.id = sc.site_id
    returning sc.id, sc.site_id, sc.user_id, s.name as site_name, s.domain, sc.name, sc.start_url, sc.steps, sc.interval_minutes, sc.consecutive_failures`);

  await Promise.all(
    due.map(async (sc) => {
      const startedAt = opts.now?.() ?? new Date();
      const run = await runScenario(pool, { startUrl: sc.start_url, steps: sc.steps, domain: sc.domain }, opts.policy);
      const now = opts.now?.() ?? new Date();
      await recordScenarioRun(db, sc, run, startedAt, now, opts.workerId);
    }),
  );
  return due.length;
}

export async function recordScenarioRun(db: Database, sc: DueScenario, run: ScenarioRunResult, startedAt: Date, now: Date, workerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    let screenshotId: string | null = null;
    if (run.screenshot && run.screenshot.length <= 2_000_000) {
      const [a] = await tx
        .insert(artifacts)
        .values({ userId: sc.user_id, kind: "screenshot", contentType: "image/jpeg", bytes: run.screenshot, expiresAt: new Date(now.getTime() + SCREENSHOT_RETENTION_DAYS * 86_400_000) })
        .returning({ id: artifacts.id });
      screenshotId = a!.id;
    }
    await tx.insert(browserTestRuns).values({
      scenarioId: sc.id,
      siteId: sc.site_id,
      userId: sc.user_id,
      startedAt,
      finishedAt: now,
      status: run.status,
      failedStep: run.failedStep,
      error: run.error,
      screenshotId,
      durationMs: run.durationMs,
      stepResults: run.steps,
    });
    const failed = run.status !== "passed";
    // Une action bloquée par sécurité est une erreur de configuration : on suspend le scénario.
    const blocked = run.status === "error" && /bloqu/i.test(run.error ?? "");
    const failures = failed ? sc.consecutive_failures + 1 : 0;
    const next = failed && failures < 2 && !blocked ? new Date(now.getTime() + SCENARIO_RETRY_DELAY_MS) : new Date(now.getTime() + sc.interval_minutes * 60_000);
    await tx.execute(sql`
      update browser_test_scenarios set last_status = ${run.status}, last_run_at = ${now.toISOString()}::timestamptz,
        last_duration_ms = ${run.durationMs}, last_error = ${run.error}, consecutive_failures = ${failures},
        next_run_at = ${next.toISOString()}::timestamptz, lease_expires_at = null, lease_owner = null,
        enabled = ${blocked ? false : true}
      where id = ${sc.id} and lease_owner = ${workerId}`);
    if (failed && (failures >= 2 || blocked)) {
      await openIncident(tx, {
        userId: sc.user_id,
        siteId: sc.site_id,
        siteName: sc.site_name,
        kind: "scenario",
        scenarioId: sc.id,
        title: blocked ? `Scénario « ${sc.name} » suspendu` : `Le parcours « ${sc.name} » échoue`,
        cause: run.failedStep ? `Étape ${run.failedStep} : ${run.error}` : (run.error ?? "Échec du scénario."),
        startedAt,
        lastError: run.error,
        screenshotId,
        failedChecks: failures,
        confirmation: blocked ? "Le scénario a été désactivé : modifiez-le pour retirer l'action bloquée." : undefined,
        now,
      });
    } else if (!failed) {
      await resolveIncident(tx, { userId: sc.user_id, siteName: sc.site_name, scenarioId: sc.id }, `Le parcours « ${sc.name} » fonctionne de nouveau.`, now);
    }
  });
}
