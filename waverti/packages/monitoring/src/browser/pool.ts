/**
 * Navigateur automatisé (Playwright/Chromium) — WORKER UNIQUEMENT.
 * Isolation : un contexte de navigation neuf par exécution (aucun cookie/stockage partagé entre
 * utilisateurs), service workers et téléchargements bloqués, trafic forcé via le proxy de sortie,
 * concurrence limitée, délai maximal par exécution.
 */
import type { Browser, BrowserContext, Page, Route } from "playwright";
import { USER_AGENT } from "@waverti/config/constants";
import { parseTargetUrl } from "../net/safe-url";
import { startEgressProxy, type EgressProxy, type EgressProxyOptions } from "./egress-proxy";

export interface BrowserPoolOptions {
  maxConcurrency?: number;
  executablePath?: string;
  egress?: EgressProxyOptions;
}

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;
  constructor(private readonly max: number) {}
  async acquire(): Promise<() => void> {
    if (this.active >= this.max) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    return () => {
      this.active--;
      this.queue.shift()?.();
    };
  }
  get load() {
    return { active: this.active, waiting: this.queue.length };
  }
}

export interface ContextPolicy {
  /** Hôtes autorisés pour les requêtes non-GET (POST, PUT…) ; null = aucune restriction supplémentaire. */
  mutatingHosts?: string[] | null;
  blockResourceTypes?: string[];
}

export class BrowserPool {
  private browser: Browser | null = null;
  private proxy: EgressProxy | null = null;
  private readonly sem: Semaphore;
  constructor(private readonly opts: BrowserPoolOptions = {}) {
    this.sem = new Semaphore(opts.maxConcurrency ?? 2);
  }

  get load() {
    return this.sem.load;
  }

  private async ensure(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    const { chromium } = await import("playwright");
    this.proxy ??= await startEgressProxy(this.opts.egress);
    this.browser = await chromium.launch({
      headless: true,
      executablePath: this.opts.executablePath || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      proxy: { server: this.proxy.url },
      args: [
        "--proxy-bypass-list=<-loopback>",
        "--disable-quic",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--disable-background-networking",
        "--disable-features=DnsOverHttps,InterestFeedContentSuggestions",
        "--disable-extensions",
        "--no-first-run",
        "--mute-audio",
      ],
    });
    return this.browser;
  }

  /** Exécute `fn` dans un contexte isolé, sous la limite de concurrence et de durée. */
  async withPage<T>(policy: ContextPolicy, timeoutMs: number, fn: (page: Page, ctx: BrowserContext) => Promise<T>): Promise<T> {
    const release = await this.sem.acquire();
    let context: BrowserContext | null = null;
    try {
      const browser = await this.ensure();
      context = await browser.newContext({
        userAgent: USER_AGENT,
        locale: "fr-FR",
        timezoneId: "Europe/Paris",
        viewport: { width: 1280, height: 900 },
        serviceWorkers: "block",
        acceptDownloads: false,
        ignoreHTTPSErrors: false,
      });
      context.setDefaultTimeout(Math.min(timeoutMs, 30_000));
      const blockTypes = new Set(policy.blockResourceTypes ?? []);
      await context.route("**/*", (route: Route) => {
        const req = route.request();
        const url = req.url();
        if (!/^https?:/i.test(url) && !url.startsWith("data:") && !url.startsWith("blob:")) return route.abort("blockedbyclient");
        if (blockTypes.has(req.resourceType())) return route.abort("blockedbyclient");
        if (policy.mutatingHosts && req.method() !== "GET" && req.method() !== "HEAD") {
          const host = new URL(url).hostname.toLowerCase();
          const ok = policy.mutatingHosts.some((h) => host === h || host.endsWith(`.${h}`));
          if (!ok) return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      const page = await context.newPage();
      const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("browser_timeout")), timeoutMs));
      return await Promise.race([fn(page, context), timer]);
    } finally {
      await context?.close().catch(() => undefined);
      release();
    }
  }

  /** Rendu d'une page générée en JavaScript (moteur A, repli après HTTP). */
  async render(url: string, opts: { timeoutMs: number; allowLoopback?: boolean; allowAnyPort?: boolean }): Promise<{ html: string; finalUrl: string; status: number }> {
    parseTargetUrl(url, { allowAnyPort: opts.allowAnyPort, allowLoopback: opts.allowLoopback });
    return this.withPage({ blockResourceTypes: ["image", "media", "font"], mutatingHosts: [] }, opts.timeoutMs, async (page) => {
      const res = await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
      return { html: await page.content(), finalUrl: page.url(), status: res?.status() ?? 0 };
    });
  }

  get blockedRequests(): number {
    return this.proxy?.blocked ?? 0;
  }

  async close(): Promise<void> {
    // Arrêt borné : un navigateur bloqué ne doit pas empêcher l'arrêt du worker.
    const bounded = (p: Promise<unknown> | undefined) => Promise.race([p?.catch(() => undefined), new Promise((r) => setTimeout(r, 5000).unref())]);
    await bounded(this.browser?.close());
    await bounded(this.proxy?.close());
    this.browser = null;
    this.proxy = null;
  }
}
