import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashOpaqueToken,
  hashPassword,
  hashRecoveryCode,
  needsRehash,
  newOpaqueToken,
  normalizeRecoveryCode,
  otpauthUri,
  parseEncryptionKey,
  totpCode,
  verifyPassword,
  verifyTotp,
} from "../src";

describe("mots de passe (scrypt)", () => {
  it("hache avec un sel aléatoire et vérifie en temps constant", async () => {
    const a = await hashPassword("Mot-de-passe-2026");
    const b = await hashPassword("Mot-de-passe-2026");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$16\$8\$1\$/);
    expect(await verifyPassword("Mot-de-passe-2026", a)).toBe(true);
    expect(await verifyPassword("mot-de-passe-2026", a)).toBe(false);
    expect(needsRehash(a)).toBe(false);
  });

  it("refuse les empreintes malformées ou absentes", async () => {
    for (const bad of [null, "", "bcrypt$x", "scrypt$99$8$1$aa$bb", "scrypt$16$8$1$aa"]) expect(await verifyPassword("x", bad)).toBe(false);
  });
});

describe("TOTP (RFC 6238)", () => {
  // Vecteur officiel RFC 6238 (SHA-1, secret ASCII « 12345678901234567890 », T = 59 s → 94287082, 6 derniers chiffres).
  const rfcSecret = base32Encode(Buffer.from("12345678901234567890"));
  it("produit le code de référence de la RFC", () => {
    expect(totpCode(rfcSecret, 1)).toBe("287082");
    expect(base32Decode(rfcSecret).toString()).toBe("12345678901234567890");
  });

  it("accepte ±1 pas, refuse le rejeu et les codes faux", () => {
    const s = generateTotpSecret();
    const now = Date.now();
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(s, totpCode(s, step), { now })).toBe(step);
    expect(verifyTotp(s, totpCode(s, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(s, totpCode(s, step - 3), { now })).toBeNull();
    expect(verifyTotp(s, totpCode(s, step), { now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(s, "12345", { now })).toBeNull();
  });

  it("génère une URI otpauth lisible par les applications", () => {
    expect(otpauthUri("Waverti", "a@b.fr", "ABC")).toBe("otpauth://totp/Waverti%3Aa%40b.fr?secret=ABC&issuer=Waverti&algorithm=SHA1&digits=6&period=30");
  });
});

describe("chiffrement des secrets (AES-256-GCM)", () => {
  const key = parseEncryptionKey(randomBytes(32).toString("base64"));
  it("chiffre de façon non déterministe et détecte toute altération", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP", key);
    expect(a).not.toBe(encryptSecret("JBSWY3DPEHPK3PXP", key));
    expect(decryptSecret(a, key)).toBe("JBSWY3DPEHPK3PXP");
    const parts = a.split(".");
    const tampered = [...parts.slice(0, 3), Buffer.from("autre").toString("base64url")].join(".");
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(a, parseEncryptionKey(randomBytes(32).toString("hex")))).toThrow();
  });
  it("exige une clé de 32 octets", () => {
    expect(() => parseEncryptionKey(undefined)).toThrow(/WAVERTI_ENCRYPTION_KEY/);
    expect(() => parseEncryptionKey("court")).toThrow(/32 octets/);
  });
});

describe("codes de récupération et jetons", () => {
  it("10 codes uniques, normalisés et hachés avec poivre", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    const pepper = "p".repeat(40);
    expect(hashRecoveryCode(codes[0]!.toLowerCase().replace("-", " "), pepper)).toBe(hashRecoveryCode(codes[0]!, pepper));
    expect(normalizeRecoveryCode("invalide")).toBeNull();
  });
  it("jeton opaque de 256 bits, seule l'empreinte est stockée", () => {
    const { token, hash } = newOpaqueToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hashOpaqueToken(token)).toBe(hash);
  });
});
