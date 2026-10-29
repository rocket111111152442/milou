import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isPublicAddress } from "../src/net/ip-policy";
import { canonicalUrl, parseTargetUrl } from "../src/net/safe-url";
import { FetchError, safeFetch, type Resolver } from "../src/net/safe-fetch";
import { isAllowedByRules, parseRobots, RobotsCache } from "../src/net/robots";
import { HostPoliteness } from "../src/net/politeness";

let server: Server;
let port = 0;
const bomb = gzipSync(Buffer.alloc(50 * 1024 * 1024, 0));
let robotsMode: "ok" | "404" | "500" = "ok";

beforeAll(async () => {
  server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    switch (u.pathname) {
      case "/page":
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<html><head><title>Bonjour</title></head><body>Prix : 12,50 €</body></html>");
        return;
      case "/to-metadata":
        res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
        res.end();
        return;
      case "/to-file":
        res.writeHead(302, { location: "file:///etc/passwd" });
        res.end();
        return;
      case "/to-redis":
        res.writeHead(302, { location: `http://127.0.0.1:6379/` });
        res.end();
        return;
      case "/loop":
        res.writeHead(302, { location: "/loop" });
        res.end();
        return;
      case "/to-page":
        res.writeHead(301, { location: "/page" });
        res.end();
        return;
      case "/big":
        res.writeHead(200, { "content-type": "text/html" });
        for (let i = 0; i < 20; i++) res.write(Buffer.alloc(512 * 1024, 97));
        res.end();
        return;
      case "/bomb":
        res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
        res.end(bomb);
        return;
      case "/slow":
        return; // ne répond jamais
      case "/image":
        res.writeHead(200, { "content-type": "image/png" });
        res.end(Buffer.alloc(10));
        return;
      case "/latin1":
        res.writeHead(200, { "content-type": "text/html; charset=iso-8859-1" });
        res.end(Buffer.from("<p>Prix spécial : 9,99 €</p>", "latin1"));
        return;
      case "/robots.txt":
        if (robotsMode === "404") {
          res.writeHead(404);
          res.end();
        } else if (robotsMode === "500") {
          res.writeHead(500);
          res.end();
        } else {
          res.writeHead(200, { "content-type": "text/plain" });
          res.end("User-agent: *\nDisallow: /private\n\nUser-agent: WatchlyBot\nDisallow: /no-watchly\nAllow: /no-watchly/ok\n");
        }
        return;
      default:
        res.writeHead(404);
        res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const local = (path: string) => `http://127.0.0.1:${port}${path}`;
const testOpts = { allowLoopback: true, allowAnyPort: true } as const;

async function expectCode(p: Promise<unknown>, code: FetchError["code"]) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(FetchError);
  expect((err as FetchError).code).toBe(code);
}

describe("IP policy", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.1",
    "172.16.5.4",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "192.0.2.1",
    "198.18.0.1",
    "240.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::1",
    "2001:db8::1",
    "not-an-ip",
  ])("rejects non-public address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("accepts public address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
});

describe("URL policy", () => {
  it.each([
    ["file:///etc/passwd", "unsupported_protocol"],
    ["ftp://example.com/x", "unsupported_protocol"],
    ["gopher://example.com:70/", "unsupported_protocol"],
    ["javascript:alert(1)", "unsupported_protocol"],
    ["data:text/html,hi", "unsupported_protocol"],
    ["http://user:pass@example.com/", "credentials_in_url"],
    ["http://example.com:22/", "blocked_port"],
    ["http://example.com:6379/", "blocked_port"],
    ["http://localhost/", "blocked_host"],
    ["http://intranet/", "blocked_host"],
    ["http://printer.local/", "blocked_host"],
    ["http://metadata.google.internal/", "blocked_host"],
    ["pas une url", "invalid_url"],
  ])("rejects %s", (input, code) => {
    expect(() => parseTargetUrl(input)).toThrow(expect.objectContaining({ code }));
  });

  it("accepts standard public URLs and strips fragments", () => {
    expect(parseTargetUrl("https://www.exemple.fr/produit?id=1#avis").toString()).toBe("https://www.exemple.fr/produit?id=1");
    expect(parseTargetUrl("http://exemple.fr:8080/").port).toBe("8080");
  });

  it("removes tracking parameters for cache sharing", () => {
    expect(canonicalUrl(new URL("https://Ex.fr/p?id=3&utm_source=x&fbclid=y"))).toBe("https://ex.fr/p?id=3");
  });
});

describe("safeFetch — SSRF protections", () => {
  it("blocks loopback and private IP literals before any connection (all notations)", async () => {
    await expectCode(safeFetch(local("/page"), { allowAnyPort: true }), "blocked_host");
    await expectCode(safeFetch(`http://2130706433:${port}/page`, { allowAnyPort: true }), "blocked_host");
    await expectCode(safeFetch(`http://0x7f.0.0.1:${port}/page`, { allowAnyPort: true }), "blocked_host");
    await expectCode(safeFetch(`http://017700000001:${port}/page`, { allowAnyPort: true }), "blocked_host");
    await expectCode(safeFetch(`http://[::1]:${port}/page`, { allowAnyPort: true }), "blocked_host");
    await expectCode(safeFetch(`http://[::ffff:7f00:1]:${port}/page`, { allowAnyPort: true }), "blocked_host");
    await expectCode(safeFetch("http://169.254.169.254/latest/meta-data/"), "blocked_host");
    await expectCode(safeFetch("http://[fd00:ec2::254]/latest/meta-data/"), "blocked_host");
  });

  it("blocks domains that resolve to private addresses (including mixed answers)", async () => {
    const privateResolver: Resolver = async () => [{ address: "10.0.0.5", family: 4 }];
    await expectCode(safeFetch("http://evil.example.com/", { resolver: privateResolver }), "blocked_address");
    const mixed: Resolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.0.10", family: 4 },
    ];
    await expectCode(safeFetch("http://evil.example.com/", { resolver: mixed }), "blocked_address");
  });

  it("validates the address at connection time (DNS rebinding cannot swap in a private IP)", async () => {
    let calls = 0;
    const rebinding: Resolver = async () => (calls++ === 0 ? [{ address: "127.0.0.1", family: 4 }] : [{ address: "10.1.1.1", family: 4 }]);
    // Le premier appel (connexion réelle) est loopback autorisé en test ; toute nouvelle résolution est revalidée.
    const ok = await safeFetch(`http://rebind.example.com:${port}/page`, { ...testOpts, resolver: rebinding });
    expect(ok.status).toBe(200);
    expect(ok.remoteAddress).toBe("127.0.0.1");
    await expectCode(safeFetch(`http://rebind.example.com:${port}/page`, { ...testOpts, resolver: rebinding }), "blocked_address");
  });

  it("re-validates every redirect", async () => {
    await expectCode(safeFetch(local("/to-metadata"), testOpts), "blocked_host");
    await expectCode(safeFetch(local("/to-file"), testOpts), "unsupported_protocol");
    await expectCode(safeFetch(local("/to-redis"), { allowLoopback: true }), "blocked_port");
    await expectCode(safeFetch(local("/loop"), testOpts), "too_many_redirects");
    const followed = await safeFetch(local("/to-page"), testOpts);
    expect(followed).toMatchObject({ status: 200, redirects: 1, finalUrl: local("/page") });
  });

  it("caps the body size, including after decompression (zip bomb)", async () => {
    const big = await safeFetch(local("/big"), { ...testOpts, maxBytes: 1024 * 1024 });
    expect(big.truncated).toBe(true);
    expect(big.body.length).toBe(1024 * 1024);
    const bombRes = await safeFetch(local("/bomb"), { ...testOpts, maxBytes: 2 * 1024 * 1024 });
    expect(bombRes.truncated).toBe(true);
    expect(bombRes.body.length).toBe(2 * 1024 * 1024);
  });

  it("enforces timeouts", async () => {
    const t0 = Date.now();
    await expectCode(safeFetch(local("/slow"), { ...testOpts, timeoutMs: 600 }), "timeout");
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("refuses unsupported content types", async () => {
    await expectCode(safeFetch(local("/image"), { ...testOpts, allowedContentTypes: /^(text\/html|text\/plain)/ }), "unsupported_content");
  });
});

describe("robots.txt", () => {
  it("parses groups, prefers the specific agent and the longest rule", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: WatchlyBot\nDisallow: /private\nAllow: /private/public\nDisallow: /*.pdf$\n");
    expect(isAllowedByRules(rules, "/produit")).toBe(true);
    expect(isAllowedByRules(rules, "/private/x")).toBe(false);
    expect(isAllowedByRules(rules, "/private/public/y")).toBe(true);
    expect(isAllowedByRules(rules, "/docs/a.pdf")).toBe(false);
    expect(isAllowedByRules(rules, "/docs/a.pdf?x=1")).toBe(true);
    const generic = parseRobots("User-agent: *\nDisallow: /admin\n");
    expect(isAllowedByRules(generic, "/admin/login")).toBe(false);
  });

  it("applies RFC 9309 status handling (4xx allow all, 5xx disallow all)", async () => {
    robotsMode = "ok";
    let cache = new RobotsCache(testOpts);
    expect(await cache.isAllowed(new URL(local("/no-watchly/x")))).toBe(false);
    expect(await cache.isAllowed(new URL(local("/no-watchly/ok")))).toBe(true);
    expect(await cache.isAllowed(new URL(local("/private")))).toBe(true); // groupe « * » ignoré car groupe spécifique présent
    robotsMode = "404";
    cache = new RobotsCache(testOpts);
    expect(await cache.isAllowed(new URL(local("/anything")))).toBe(true);
    robotsMode = "500";
    cache = new RobotsCache(testOpts);
    expect(await cache.isAllowed(new URL(local("/anything")))).toBe(false);
    robotsMode = "ok";
  });
});

describe("host politeness", () => {
  it("spaces requests to the same host and refuses long waits", async () => {
    const p = new HostPoliteness(150, 400);
    const t0 = Date.now();
    await p.acquire("a.test");
    await p.acquire("a.test");
    expect(Date.now() - t0).toBeGreaterThanOrEqual(140);
    expect(await p.acquire("b.test")).toBe(true);
    const burst = await Promise.all([p.acquire("c.test"), p.acquire("c.test"), p.acquire("c.test"), p.acquire("c.test")]);
    expect(burst).toEqual([true, true, true, false]);
  });
});

describe("charset", () => {
  it("decodes latin-1 pages", async () => {
    const { decodeBody } = await import("../src/net/safe-fetch");
    const r = await safeFetch(local("/latin1"), testOpts);
    expect(decodeBody(r.body, r.contentType)).toContain("spécial");
  });
});
