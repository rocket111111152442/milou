/**
 * Navigateur réel (Chromium) derrière le proxy de sortie : vérifie le rendu JS et le blocage
 * des accès au réseau interne même lorsqu'ils sont déclenchés par le JavaScript de la page.
 */
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserPool } from "../src/browser/pool";
import { startEgressProxy } from "../src/browser/egress-proxy";
import { extractPage } from "../src/extract/html";

let site: Server;
let internal: Server;
let sitePort = 0;
let internalPort = 0;
let internalHits = 0;

beforeAll(async () => {
  internal = createServer((_req, res) => {
    internalHits++;
    res.end("SECRET");
  });
  await new Promise<void>((r) => internal.listen(0, "127.0.0.1", () => r()));
  internalPort = (internal.address() as { port: number }).port;
  site = createServer((req, res) => {
    if (req.url === "/spa") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<html><body><div id="root"></div><script>
        document.getElementById('root').innerHTML = '<h1>Produit</h1><p class="price">1 249,00 €</p><p>En stock</p>';
        fetch('http://10.255.255.1:${internalPort}/x').catch(()=>{});
        fetch('http://169.254.169.254/latest/meta-data/').catch(()=>{});
      </script></body></html>`);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => site.listen(0, "127.0.0.1", () => r()));
  sitePort = (site.address() as { port: number }).port;
});
afterAll(async () => {
  site.close();
  internal.close();
});

describe("egress proxy", () => {
  it("refuses CONNECT and plain requests to private targets", async () => {
    const proxy = await startEgressProxy({ allowAnyPort: true });
    const res = await fetch(`http://127.0.0.1:${proxy.port}`, { method: "GET" }).catch(() => null);
    expect(res === null || res.status >= 400).toBe(true);
    const net = await import("node:net");
    const reply = await new Promise<string>((resolve) => {
      const s = net.connect(proxy.port, "127.0.0.1", () => s.write(`CONNECT 127.0.0.1:${internalPort} HTTP/1.1\r\nHost: x\r\n\r\n`));
      s.once("data", (d) => {
        resolve(d.toString());
        s.destroy();
      });
    });
    expect(reply).toMatch(/403/);
    expect(proxy.blocked).toBeGreaterThan(0);
    await proxy.close();
  });
});

describe.skipIf(process.env.SKIP_BROWSER_TESTS === "1")("browser pool", () => {
  it("renders JavaScript pages and blocks requests to internal networks", async () => {
    const pool = new BrowserPool({ maxConcurrency: 1, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/opt/pw-browsers/chromium", egress: { allowLoopback: true, allowAnyPort: true } });
    try {
      const r = await pool.render(`http://127.0.0.1:${sitePort}/spa`, { timeoutMs: 20_000, allowLoopback: true, allowAnyPort: true });
      const obs = extractPage({ html: r.html, url: r.finalUrl, finalUrl: r.finalUrl, httpStatus: r.status, method: "browser" });
      expect(obs).toMatchObject({ price: 1249, availability: "in_stock", method: "browser" });
      expect(internalHits).toBe(0);
      expect(pool.blockedRequests).toBeGreaterThanOrEqual(1);
    } finally {
      await pool.close();
    }
  }, 60_000);

  it("refuses to navigate to private addresses", async () => {
    const pool = new BrowserPool({ maxConcurrency: 1, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/opt/pw-browsers/chromium" });
    try {
      await expect(pool.render("http://169.254.169.254/", { timeoutMs: 5000 })).rejects.toThrow();
    } finally {
      await pool.close();
    }
  });

  it("reads the Amazon purchase price when the decimal separator wraps to a new line", async () => {
    const pool = new BrowserPool({ maxConcurrency: 1, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/opt/pw-browsers/chromium" });
    const source = await readFile(new URL("../../../tools/browser-capture/capture.js", import.meta.url), "utf8");
    const url = "https://www.amazon.fr/dp/B0FQH1258Z";
    const amount = (className: string, whole: string, fraction: string) => `
      <span class="a-price ${className}">
        <span class="a-offscreen"></span>
        <span aria-hidden="true"><span class="a-price-whole">${whole}<br>,</span><span class="a-price-fraction">${fraction}</span><span class="a-price-symbol">€</span></span>
      </span>`;
    const main = `<div id="corePriceDisplay_desktop_feature_div" data-csa-c-asin="B0FQH1258Z">
      ${amount("priceToPay", "1 297", "99")}
      ${amount("a-text-price", "1 499", "99")}
    </div>
    <aside>Avec le coupon : 1 241,10 €</aside>
    <div data-csa-c-asin="B0FQH1258Y">${amount("priceToPay", "1 249", "00")}</div>`;
    const otherCorePrice = (whole: string) => `<div id="corePrice_feature_div" data-csa-c-asin="B0FQH1258Z">
      ${amount("apex-pricetopay-value", whole, "99")}
    </div>`;
    try {
      await pool.withPage({}, 20_000, async (page) => {
        for (const [html, price] of [
          [main, 1297.99],
          [main + otherCorePrice("1 297"), 1297.99],
          [main + otherCorePrice("1 249"), null],
        ] as const) {
          await page.setContent(html);
          expect(await page.locator("#corePriceDisplay_desktop_feature_div .priceToPay .a-price-whole").innerText()).toBe("1 297\n,");
          await page.addScriptTag({ content: source.replace(/^export /m, "") });
          const reading = await page.evaluate((href) => (
            globalThis as unknown as { capturePage: (value: string) => unknown }
          ).capturePage(href), url);
          expect(reading).toMatchObject({ price, currency: price === null ? null : "EUR" });
        }
      });
    } finally {
      await pool.close();
    }
  });
});
