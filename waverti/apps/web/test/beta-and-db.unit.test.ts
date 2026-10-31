import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { autoBetaGrant, isBootstrapAdmin, isSignupAllowed, signupMode } from "../src/lib/beta";
import { databaseUrl } from "../src/lib/database-url";
import { EXPECTED_MIGRATIONS } from "../src/lib/schema-version";

describe("base de données selon l'environnement Vercel", () => {
  const url = "postgresql://u:p@h/db";
  it("la production et les machines locales utilisent la base", () => {
    expect(databaseUrl({ DATABASE_URL: url, VERCEL_ENV: "production" })).toBe(url);
    expect(databaseUrl({ DATABASE_URL: url })).toBe(url);
  });
  it("une prévisualisation n'écrit jamais dans la base partagée, sauf autorisation explicite", () => {
    expect(databaseUrl({ DATABASE_URL: url, VERCEL_ENV: "preview" })).toBeNull();
    expect(databaseUrl({ DATABASE_URL: url, VERCEL_ENV: "development" })).toBeNull();
    expect(databaseUrl({ DATABASE_URL: url, VERCEL_ENV: "preview", WAVERTI_PREVIEW_DATABASE: "1" })).toBe(url);
    expect(databaseUrl({ VERCEL_ENV: "production" })).toBeNull();
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
