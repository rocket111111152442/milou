import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@waverti/database";
import { previewPage, runPageCheck } from "../src/runner";
import { HostPoliteness } from "../src/net/politeness";
import { RobotsCache } from "../src/net/robots";

describe("existing runner with real local HTTP", () => {
  let server: Server;
  let origin: string;
  const fetchOptions = { allowLoopback: true, allowAnyPort: true };
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/robots.txt") { res.end("User-agent: *\nDisallow: /private"); return; }
      if (req.url === "/redirect") { res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }); res.end(); return; }
      res.setHeader("content-type", req.url === "/feed" ? "application/rss+xml" : "text/html");
      if (req.url === "/cached") res.setHeader("cache-control", "public, max-age=60");
      if (req.url === "/restricted") { res.statusCode = 403; res.end("Access denied"); return; }
      if (req.url === "/js") { res.end('<div id="root"></div>'); return; }
      if (req.url === "/feed") { res.end("<rss><channel><title>Mon flux</title><item><title>Annonce</title></item></channel></rss>"); return; }
      res.end("<title>Page</title><main><h1>Bienvenue</h1><p>Contenu public.</p></main>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  const target = (path: string) => ({ url: `${origin}${path}`, cssSelector: null, renderMode: "auto" as const });
  function deps() {
    const execute = vi.fn().mockResolvedValue([]);
    return { db: { execute } as unknown as Database, execute, robots: new RobotsCache(fetchOptions), politeness: new HostPoliteness(0), fetchOptions, recordUsage: vi.fn() };
  }
  it("reads a feed through preview and worker without a second transport", async () => {
    expect((await previewPage(target("/feed"), fetchOptions)).observation?.title).toBe("Mon flux");
    expect((await runPageCheck(deps(), target("/feed"))).observation?.title).toBe("Mon flux");
  });
  it("does not cache a source without explicit freshness", async () => {
    const d = deps(); await runPageCheck(d, target("/")); expect(d.execute).toHaveBeenCalledTimes(1);
    const cached = deps(); await runPageCheck(cached, target("/cached")); expect(cached.execute).toHaveBeenCalledTimes(2);
  });
  it("reports restrictions and does not invoke the browser", async () => {
    const render = vi.fn();
    const r = await runPageCheck({ ...deps(), browser: { render } }, target("/restricted"));
    expect(r.error?.code).toBe("access_restricted"); expect(render).not.toHaveBeenCalled();
  });
  it("uses an injected renderer only for a shell and accounts for its use", async () => {
    const d = deps();
    const render = vi.fn().mockResolvedValue({ html: "<title>Rendu</title><p>Contenu chargé</p>", finalUrl: `${origin}/js`, status: 200 });
    expect((await runPageCheck({ ...d, browser: { render } }, target("/"))).observation?.method).toBe("http");
    expect(render).not.toHaveBeenCalled();
    expect((await runPageCheck({ ...d, browser: { render } }, target("/js"))).observation?.method).toBe("browser");
    expect(render).toHaveBeenCalledTimes(1);
    expect(d.recordUsage).toHaveBeenCalledWith({ provider: "playwright", cacheHit: false });
  });
  it("reports a missing renderer instead of claiming an empty shell is compatible", async () => {
    expect((await previewPage(target("/js"), fetchOptions)).error?.code).toBe("render_required");
    expect((await runPageCheck(deps(), target("/js"))).error?.code).toBe("render_required");
  });
  it("preserves robots and redirect SSRF protection", async () => {
    expect((await previewPage(target("/private"), fetchOptions)).error?.code).toBe("robots_disallowed");
    expect((await previewPage(target("/redirect"), fetchOptions)).error?.code).toBe("blocked_host");
  });
});
