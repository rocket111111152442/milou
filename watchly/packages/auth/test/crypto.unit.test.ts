import { describe, expect, it } from "vitest";
import {
  generateUserCode,
  normalizeEmailForAbuse,
  normalizeUserCode,
  pepperedHash,
  randomToken,
  sha256Hex,
} from "../src/crypto";
import { assertRole, AuthError } from "../src/roles";
import { bearerFrom, newDeviceToken } from "../src/devices";

const PEPPER = "x".repeat(40);

describe("crypto helpers", () => {
  it("produces unique high-entropy tokens", () => {
    const set = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(set.size).toBe(200);
    expect(randomToken().length).toBeGreaterThanOrEqual(43);
  });

  it("hashes device tokens deterministically and never returns the clear token", () => {
    const { token, hash } = newDeviceToken();
    expect(token.startsWith("wly_dev_")).toBe(true);
    expect(hash).toBe(sha256Hex(token));
    expect(hash).not.toContain(token);
  });

  it("refuses peppered hashes without a strong pepper", () => {
    expect(() => pepperedHash("a@b.c", "short")).toThrow(/WATCHLY_HASH_PEPPER/);
    expect(pepperedHash("a@b.c", PEPPER)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes e-mail aliases used to farm free trials", () => {
    expect(normalizeEmailForAbuse("John.Doe+trial@GMAIL.com")).toBe("johndoe@gmail.com");
    expect(normalizeEmailForAbuse("j.doe@googlemail.com")).toBe("jdoe@gmail.com");
    expect(normalizeEmailForAbuse("a.b+x@exemple.fr")).toBe("a.b@exemple.fr");
  });

  it("generates readable device link codes", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateUserCode();
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(normalizeUserCode(c.toLowerCase().replace("-", " "))).toBe(c);
    }
    expect(normalizeUserCode("abc")).toBeNull();
  });

  it("parses bearer headers strictly", () => {
    expect(bearerFrom("Bearer abc")).toBe("abc");
    expect(bearerFrom("Basic abc")).toBeNull();
    expect(bearerFrom(null)).toBeNull();
  });
});

describe("roles", () => {
  const base = { id: "u", email: "e", suspended: false };
  it("enforces allowed roles server-side", () => {
    expect(() => assertRole(null, ["admin"])).toThrow(AuthError);
    expect(() => assertRole({ ...base, role: "user" }, ["admin"])).toThrow(/Accès refusé/);
    expect(() => assertRole({ ...base, role: "admin", suspended: true }, ["admin"])).toThrow(/suspendu/);
    expect(assertRole({ ...base, role: "admin" }, ["admin"]).role).toBe("admin");
  });
});
