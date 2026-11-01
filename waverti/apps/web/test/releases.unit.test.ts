import { describe, expect, it, vi } from "vitest";
import { classifyAsset, latestPublished, parseChecksums, parseReleaseMarker, releasesFromGithub, versionOfTag, type GithubRelease } from "../src/lib/release-parse";

vi.mock("server-only", () => ({}));

const H = (c: string) => c.repeat(64);
const MARKER = `<!-- waverti-release ${JSON.stringify({
  tested: { "windows:nsis": "CI Windows", "windows:msi": "CI Windows", "linux:deb": "CI Ubuntu", "macos:dmg:aarch64": "CI macOS ARM" },
  testedSha: "abc1234",
})} -->`;
const ASSETS = [
  "Waverti_0.1.0_x64-setup.exe",
  "Waverti_0.1.0_x64_en-US.msi",
  "Waverti_0.1.0_amd64.deb",
  "Waverti_0.1.0_amd64.AppImage",
  "Waverti-0.1.0-1.x86_64.rpm",
  "Waverti_0.1.0_aarch64.dmg",
  "Waverti_0.1.0_x64.dmg",
  "Waverti_aarch64.app.tar.gz",
  "SHA256SUMS.txt",
].map((name, i) => ({ name, size: 1_000_000 + i }));
const SUMS = new Map(ASSETS.filter((a) => a.name !== "SHA256SUMS.txt").map((a, i) => [a.name, H("abcdef0123456789"[i % 16]!)]));
const rel = (over: Partial<GithubRelease> = {}): GithubRelease => ({ tag_name: "waverti-desktop-v0.1.0", draft: false, prerelease: true, published_at: "2026-11-01T12:00:00Z", body: `Notes\n${MARKER}`, assets: ASSETS, ...over });

describe("marqueur de tests et sommes de contrôle", () => {
  it("lit le marqueur écrit par le workflow", () => {
    expect(parseReleaseMarker(`x\n${MARKER}`)).toEqual({ tested: { "windows:nsis": "CI Windows", "windows:msi": "CI Windows", "linux:deb": "CI Ubuntu", "macos:dmg:aarch64": "CI macOS ARM" }, testedSha: "abc1234" });
  });
  it.each([null, "", "pas de marqueur", "<!-- waverti-release {pas du json} -->", '<!-- waverti-release {"tested":"oui"} -->', '<!-- waverti-release {"autre":1} -->'])("marqueur absent ou invalide (%s) → null", (b) => {
    expect(parseReleaseMarker(b)).toBeNull();
  });
  it("ignore les descriptions vides et les SHA de commit invalides", () => {
    const m = parseReleaseMarker('<!-- waverti-release {"tested":{"a":"","b":"ok"},"testedSha":"zz; rm -rf"} -->');
    expect(m).toEqual({ tested: { b: "ok" }, testedSha: undefined });
  });
  it("sha256sum : lignes valides retenues, le reste ignoré, majuscules normalisées", () => {
    const m = parseChecksums(`${H("a")}  Waverti_0.1.0_amd64.deb\n${H("B")} *Waverti_0.1.0_x64.dmg\nn'importe quoi\n${"c".repeat(63)}  court.exe\n${H("d")}  ./dossier.exe`);
    expect(m.get("Waverti_0.1.0_amd64.deb")).toBe(H("a"));
    expect(m.get("Waverti_0.1.0_x64.dmg")).toBe(H("b"));
    expect(m.has("court.exe")).toBe(false);
    expect(m.get("dossier.exe")).toBe(H("d"));
  });
});

describe("reconnaissance des installateurs", () => {
  it.each([
    ["Waverti_0.1.0_x64-setup.exe", "windows:nsis"],
    ["Waverti_0.1.0_x64_en-US.msi", "windows:msi"],
    ["Waverti_0.1.0_amd64.deb", "linux:deb"],
    ["Waverti_0.1.0_amd64.AppImage", "linux:appimage"],
    ["Waverti-0.1.0-1.x86_64.rpm", "linux:rpm"],
    ["Waverti_0.1.0_aarch64.dmg", "macos:dmg:aarch64"],
    ["Waverti_0.1.0_x64.dmg", "macos:dmg:x86_64"],
  ])("%s → %s", (name, key) => expect(classifyAsset(name, "0.1.0")?.key).toBe(key));
  it.each(["Waverti_0.2.0_x64-setup.exe", "Waverti_aarch64.app.tar.gz", "SHA256SUMS.txt", "Autre_0.1.0_x64-setup.exe", "Waverti_0.1.0_x64-setup.exe.sig", "../Waverti_0.1.0_x64-setup.exe", "Waverti_0.1.0_x64-setup.exe;rm"])("%s → ignoré", (name) => {
    expect(classifyAsset(name, "0.1.0")).toBeNull();
  });
});

describe("choix de la version publiée", () => {
  it("ignore les brouillons, les tags étrangers et les versions sans date de publication ; compare les versions en numérique", () => {
    const r = latestPublished([
      rel({ tag_name: "waverti-desktop-v0.9.0" }),
      rel({ tag_name: "waverti-desktop-v0.10.0" }),
      rel({ tag_name: "waverti-desktop-v9.9.9", draft: true }),
      rel({ tag_name: "autre-v5.0.0" }),
      rel({ tag_name: "waverti-desktop-v8.0.0", published_at: null }),
      rel({ tag_name: "waverti-desktop-vX" }),
    ]);
    expect(r?.version).toBe("0.10.0");
    expect(latestPublished([rel({ draft: true })])).toBeNull();
    expect(versionOfTag("waverti-desktop-v1.2.3")).toBe("1.2.3");
    expect(versionOfTag("waverti-desktop-v1.2")).toBeNull();
  });
});

describe("installateurs proposés au téléchargement", () => {
  const out = releasesFromGithub(rel(), "0.1.0", SUMS, "rocket111111152442/milou");
  it("seulement ceux que la CI a testés, dans un ordre stable, avec adresse reconstruite, taille et empreinte", () => {
    expect(out.map((r) => `${r.platform}:${r.packageType}:${r.arch}`)).toEqual(["windows:nsis:x86_64", "windows:msi:x86_64", "macos:dmg:aarch64", "linux:deb:x86_64"]);
    const nsis = out[0]!;
    expect(nsis.url).toBe("https://github.com/rocket111111152442/milou/releases/download/waverti-desktop-v0.1.0/Waverti_0.1.0_x64-setup.exe");
    expect(nsis).toMatchObject({ version: "0.1.0", codeSigned: false, testedOn: "CI Windows", sizeBytes: 1_000_000, publishedAt: "2026-11-01T12:00:00Z" });
    expect(nsis.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("non proposés : AppImage, rpm, macOS Intel (non testés), archives de mise à jour", () => {
    const names = out.map((r) => r.url);
    expect(names.some((u) => /AppImage|\.rpm|_x64\.dmg|tar\.gz/.test(u))).toBe(false);
  });
  it("sans marqueur de tests → aucun lien", () => {
    expect(releasesFromGithub(rel({ body: "Notes sans marqueur" }), "0.1.0", SUMS, "a/b")).toEqual([]);
  });
  it("un installateur sans somme de contrôle n'est pas proposé", () => {
    const partial = new Map(SUMS);
    partial.delete("Waverti_0.1.0_amd64.deb");
    expect(releasesFromGithub(rel(), "0.1.0", partial, "a/b").some((r) => r.packageType === "deb")).toBe(false);
  });
  it("un installateur testé mais absent des fichiers de la version n'est pas proposé", () => {
    const r = releasesFromGithub(rel({ assets: ASSETS.filter((a) => a.name !== "Waverti_0.1.0_x64-setup.exe") }), "0.1.0", SUMS, "a/b");
    expect(r.some((x) => x.packageType === "nsis")).toBe(false);
  });
  it("dépôt invalide ou nom de fichier dangereux → rien", () => {
    expect(releasesFromGithub(rel(), "0.1.0", SUMS, "a/b/../../c")).toEqual([]);
    expect(releasesFromGithub(rel(), "0.1.0", SUMS, "pas un depot")).toEqual([]);
    const evil = rel({ assets: [{ name: "Waverti_0.1.0_amd64.deb/../../x", size: 1 }] });
    expect(releasesFromGithub(evil, "0.1.0", new Map([["Waverti_0.1.0_amd64.deb/../../x", H("a")]]), "a/b")).toEqual([]);
  });
});

describe("lecture des versions GitHub (réseau simulé)", () => {
  const sumsText = [...SUMS].map(([n, h]) => `${h}  ${n}`).join("\n");
  const okFetch = (releases: unknown, sums: string | null = sumsText, status = 200) =>
    (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.github.com/repos/")) return new Response(JSON.stringify(releases), { status });
      if (url.endsWith("/SHA256SUMS.txt")) return sums === null ? new Response("", { status: 404 }) : new Response(sums, { status: 200 });
      return new Response("", { status: 500 });
    }) as typeof fetch;

  it("version publiée, testée, avec sommes de contrôle → installateurs proposés", async () => {
    const { loadGithubReleases } = await import("../src/lib/github-releases");
    const r = await loadGithubReleases({ repo: "rocket111111152442/milou", fetchImpl: okFetch([rel()]) });
    expect(r.length).toBe(4);
  });
  it.each([
    ["aucune version", okFetch([])],
    ["brouillon seulement", okFetch([rel({ draft: true })])],
    ["API en erreur", okFetch([rel()], sumsText, 500)],
    ["SHA256SUMS.txt absent", okFetch([rel()], null)],
    ["réponse invalide", (async () => new Response("pas du json", { status: 200 })) as typeof fetch],
    ["réseau coupé", (async () => { throw new Error("réseau"); }) as typeof fetch],
    ["limite de taille dépassée", okFetch([rel()], "x".repeat(70_000))],
  ])("%s → aucune offre (jamais d'erreur affichée)", async (_n, fetchImpl) => {
    const { loadGithubReleases } = await import("../src/lib/github-releases");
    expect(await loadGithubReleases({ repo: "rocket111111152442/milou", fetchImpl })).toEqual([]);
  });
  it("actif seulement sur Vercel ou avec WAVERTI_RELEASES_REPO", async () => {
    const { githubReleasesEnabled } = await import("../src/lib/github-releases");
    expect(githubReleasesEnabled({})).toBe(false);
    expect(githubReleasesEnabled({ CI: "true" })).toBe(false);
    expect(githubReleasesEnabled({ VERCEL: "1" })).toBe(true);
    expect(githubReleasesEnabled({ WAVERTI_RELEASES_REPO: "a/b" })).toBe(true);
  });
});
