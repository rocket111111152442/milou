/** Offline extraction benchmark. No live source, credentials, DB or Chromium. */
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createServer } from "node:http";
import { safeFetch } from "../src/net/safe-fetch";
import { extractPage } from "../src/extract/html";
import { extractPdfObservation, isPdf } from "../src/extract/pdf";
import { readPageResponse } from "../src/extract/response";
import { fixtures, target } from "../test/adaptive-fixtures";

const baseline = (f: typeof fixtures[number]) => {
  const r = f.res;
  if (!/^(text\/html|application\/xhtml\+xml|text\/plain|application\/json|application\/ld\+json|application\/pdf)/.test(r.contentType)) throw new Error("unsupported_content");
  const base = { url: target.url, finalUrl: r.finalUrl, httpStatus: r.status, responseMs: r.durationMs };
  return isPdf(r.contentType, r.body) ? extractPdfObservation({ ...base, body: r.body }) : extractPage({ ...base, html: r.body.toString(), method: "http" });
};
const rounds = 100;
const results = [];
for (const mode of ["baseline", "adaptive"] as const) {
  let read = 0, correct = 0;
  const failures: string[] = [];
  for (const f of fixtures) {
    try {
      const obs = mode === "baseline" ? baseline(f) : readPageResponse(f.res, target).observation;
      read++;
      if (obs.title === f.title && (!("price" in f) || obs.price === f.price)) correct++;
      else failures.push(`${f.name}: title/price mismatch`);
    } catch { failures.push(`${f.name}: unsupported/failed`); }
  }
  const start = performance.now();
  let peakRss = process.memoryUsage().rss;
  for (let i = 0; i < rounds; i++) for (const f of fixtures) {
    try { if (mode === "baseline") baseline(f); else readPageResponse(f.res, target); } catch { /* counted above */ }
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }
  results.push({ mode, fixtures: fixtures.length, decoded: read, expectedTitleAndPrice: correct, decodeRate: read / fixtures.length, extractionRate: correct / fixtures.length, meanExtractionMs: (performance.now() - start) / (rounds * fixtures.length), processPeakRssBytes: peakRss, failures });
}
// HTTP check cost on a fixed local HTML response; excludes DB, robots and scheduler.
const page = fixtures[0]!;
const server = createServer((_req, res) => { res.setHeader("content-type", "text/html"); res.end(page.res.body); });
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const localUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
const httpResults = [];
try {
  for (const mode of ["baseline", "adaptive"] as const) {
    let elapsed = 0, bodyBytes = 0;
    for (let i = 0; i < 35; i++) {
      const start = performance.now();
      const res = await safeFetch(localUrl, { allowLoopback: true, allowAnyPort: true });
      if (mode === "baseline") baseline({ ...page, res }); else readPageResponse(res, { ...target, url: localUrl });
      if (i >= 5) { elapsed += performance.now() - start; bodyBytes += res.body.length; }
    }
    httpResults.push({ mode, samples: 30, meanCheckMs: elapsed / 30, meanDecodedBodyBytes: bodyBytes / 30 });
  }
} finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
const report = { date: new Date().toISOString(), node: process.version, platform: process.platform, rounds, scope: "Extraction in one Node process. Decoded != usable/authorized. Title and price assertions only. RSS includes runtime, both engines and GC; not per-check allocation. HTTP timings use one local HTML page, 5 warmups then 30 samples, no DB/robots/scheduler/TLS. Payload bytes exclude headers and wire compression. No Chromium or monetary cost measured. Sequential engine order and OS contention limit timing comparisons.", results, httpResults };
writeFileSync("docs/ADAPTIVE-BENCHMARK.json", JSON.stringify(report, null, 2) + "\n");
console.info(JSON.stringify(report, null, 2));
