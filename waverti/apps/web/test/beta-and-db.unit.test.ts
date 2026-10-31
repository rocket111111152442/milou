import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { autoBetaGrant, isBootstrapAdmin, isSignupAllowed, signupMode } from "../src/lib/beta";
import { databaseUrl, directDatabaseUrl, sameServer } from "../src/lib/database-url";
import { EXPECTED_MIGRATIONS } from "../src/lib/schema-version";

describe("base de données selon l'environnement Vercel", () => {
  const url = "postgresql://u:p@h/db";
  it("la production et les machines locales utilisent la base", () => {
    expect(databaseUrl({ DATABASE_URL: url, VERCEL_ENV: "production" })).toBe(url);
    expect(databaseUrl({ DATABASE_URL: url })).toBe(url);
  });
  it("une prévisualisation n'utilise jamais la base de production, seulement PREVIEW_DATABASE_URL", () => {
    const prod = "postgresql://u:p@ep-prod-123-pooler.eu-central-1.aws.neon.tech/neondb";
    const test = "postgresql://u:p@ep-test-456-pooler.eu-central-1.aws.neon.tech/neondb";
    expect(databaseUrl({ DATABASE_URL: prod, VERCEL_ENV: "preview" })).toBeNull();
    expect(databaseUrl({ DATABASE_URL: prod, VERCEL_ENV: "development" })).toBeNull();
    expect(databaseUrl({ DATABASE_URL: prod, VERCEL_ENV: "preview", WAVERTI_PREVIEW_DATABASE: "1" })).toBeNull();
    expect(databaseUrl({ DATABASE_URL: prod, PREVIEW_DATABASE_URL: test, VERCEL_ENV: "preview" })).toBe(test);
    expect(databaseUrl({ DATABASE_URL: prod, PREVIEW_DATABASE_URL: test, VERCEL_ENV: "production" })).toBe(prod);
    expect(databaseUrl({ VERCEL_ENV: "production" })).toBeNull();
  });
  it("refuse une base de test qui pointe vers le serveur de production", () => {
    const prod = "postgresql://u:p@ep-prod-123-pooler.eu-central-1.aws.neon.tech/neondb";
    const sameDirect = "postgresql://u:p@ep-prod-123.eu-central-1.aws.neon.tech/autre";
    expect(sameServer(prod, sameDirect)).toBe(true);
    expect(databaseUrl({ DATABASE_URL: prod, PREVIEW_DATABASE_URL: sameDirect, VERCEL_ENV: "preview" })).toBeNull();
    expect(directDatabaseUrl({ DATABASE_URL: prod, DATABASE_URL_UNPOOLED: sameDirect.replace("/autre", "/neondb"), PREVIEW_DATABASE_URL: "postgresql://u:p@ep-test-1-pooler.x.neon.tech/db", PREVIEW_DATABASE_URL_UNPOOLED: sameDirect, VERCEL_ENV: "preview" })).toBeNull();
    expect(directDatabaseUrl({ DATABASE_URL: prod, PREVIEW_DATABASE_URL: "postgresql://u:p@ep-test-1-pooler.x.neon.tech/db", PREVIEW_DATABASE_URL_UNPOOLED: "postgresql://u:p@ep-test-1.x.neon.tech/db", VERCEL_ENV: "preview" })).toBe("postgresql://u:p@ep-test-1.x.neon.tech/db");
  });
  it("le nombre de migrations attendu correspond aux fichiers de db/migrations", () => {
    const files = readdirSync(join(import.meta.dirname, "../../../db/migrations")).filter((f) => f.endsWith(".sql"));
    expect(EXPECTED_MIGRATIONS).toBe(files.length);
  });
});

describe("bêta privée sur invitation", () => {
  const env = { WAVERTI_SIGNUP_ALLOWLIST: "Moi@Exemple.fr, ami@exemple.fr", WAVERTI_BETA_AUTO_GRANT: "pro:30", WAVERTI_BOOTSTRAP_ADMINS: "moi@exemple.fr" };
  it("inscription ouverte sans liste (développement), fermée aux non-invités avec liste", () => {
    expect(signupMode({})).toBe("open");
    expect(isSignupAllowed("x@y.fr", {})).toBe(true);
    expect(signupMode(env)).toBe("invite");
    expect(isSignupAllowed(" MOI@exemple.fr ", env)).toBe(true);
    expect(isSignupAllowed("ami@exemple.fr", env)).toBe(true);
    expect(isSignupAllowed("inconnu@exemple.fr", env)).toBe(false);
  });
  it("WAVERTI_SIGNUP_MODE=open : inscription ouverte à tous, la liste garde son rôle d'invitation", async () => {
    const open = { ...env, WAVERTI_SIGNUP_MODE: "open" };
    expect(signupMode(open)).toBe("open");
    expect(isSignupAllowed("inconnu@exemple.fr", open)).toBe(true);
    const { isInvited } = await import("../src/lib/beta");
    expect(isInvited("ami@exemple.fr", open)).toBe(true);
    expect(isInvited("inconnu@exemple.fr", open)).toBe(false);
  });
  it("accès bêta automatique borné à 60 jours ; formule invalide ignorée", () => {
    expect(autoBetaGrant(env)).toEqual({ planId: "pro", days: 30 });
    expect(autoBetaGrant({ WAVERTI_BETA_AUTO_GRANT: "max:365" })).toEqual({ planId: "max", days: 60 });
    expect(autoBetaGrant({ WAVERTI_BETA_AUTO_GRANT: "gratuit:30" })).toBeNull();
    expect(autoBetaGrant({})).toBeNull();
  });
  it("administrateur d'amorçage uniquement pour les adresses listées", () => {
    expect(isBootstrapAdmin("moi@exemple.fr", env)).toBe(true);
    expect(isBootstrapAdmin("ami@exemple.fr", env)).toBe(false);
  });
});
