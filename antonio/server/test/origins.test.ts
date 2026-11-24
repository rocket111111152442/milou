import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { resetConfigForTests } from "../src/config.js";
import { closeDb } from "../src/db/client.js";

let app: FastifyInstance;
let sourceAddress = 1;
const nextAddress = () => `127.0.0.${sourceAddress++}`;
beforeAll(async () => {
  // Exercise the production guard, which ordinary test-mode requests bypass.
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_BASE_URL", "https://waverti.vercel.app");
  vi.stubEnv("API_PUBLIC_URL", "https://waverti.vercel.app");
  vi.stubEnv("APP_ALLOWED_ORIGINS", "https://waverti.com, https://www.waverti.com");
  resetConfigForTests();
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await closeDb();
  vi.unstubAllEnvs();
  resetConfigForTests();
});

describe("Production registration origins", () => {
  it.each(["https://waverti.vercel.app", "https://waverti.com", "https://www.waverti.com"])("creates an authenticated account from %s", async (origin) => {
    const res = await app.inject({
      method: "POST", url: "/api/auth/register", headers: { origin }, remoteAddress: nextAddress(),
      payload: { email: `origin-${crypto.randomUUID()}@test.example`, password: "Compte-origine-local-2026", displayName: "Test origine", withDemo: false },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.headers["set-cookie"] as string;
    expect(cookie).toContain("Secure");
    const me = await app.inject({url: "/api/auth/me", headers: {cookie: cookie.split(";")[0]}});
    expect(me.statusCode).toBe(200);
    expect(me.json().user.id).toBe(res.json().userId);
  });

  it.each(["https://foreign.example", "https://waverti.com.foreign.example", "http://waverti.com", "null"])("rejects %s even with a forged host", async (origin) => {
    const res = await app.inject({
      method: "POST", url: "/api/auth/register", remoteAddress: nextAddress(),
      headers: {origin, host: "waverti.com", "x-forwarded-host": "waverti.com"}, payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("bad_origin");
  });

  it("uses a valid same-site referer when Origin is absent", async () => {
    const res = await app.inject({method: "POST", url: "/api/auth/register", remoteAddress: nextAddress(), headers: {referer: "https://waverti.com/inscription"}, payload: {}});
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("validation");
  });

  it.each([{}, {referer: "not a URL"}, {origin: "https://foreign.example", referer: "https://waverti.com/inscription"}])("rejects missing or invalid origins", async (headers) => {
    const res = await app.inject({method: "POST", url: "/api/auth/register", remoteAddress: nextAddress(), headers, payload: {}});
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("bad_origin");
  });
});
