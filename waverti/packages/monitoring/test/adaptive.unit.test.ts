import { describe, expect, it } from "vitest";
import { pageObservationSchema } from "@waverti/types";
import { readPageResponse, sharedCacheTtl, PAGE_CONTENT_TYPES } from "../src/extract/response";
import { fixtures, response, target } from "./adaptive-fixtures";

describe("adaptive response reader", () => {
  it.each(fixtures)("$name", (f) => {
    const r = readPageResponse(f.res, target);
    expect(r.format).toBe(f.format);
    expect(r.needsBrowser).toBe(f.needsBrowser);
    expect(r.observation.title).toBe(f.title);
    expect(r.blocked).toBe("blocked" in f ? f.blocked : false);
    if ("price" in f) expect(r.observation.price).toBe(f.price);
    expect(pageObservationSchema.safeParse(r.observation).success).toBe(true);
    expect(r.observation.httpStatus).toBe(f.res.status);
  });
  it("refuses truncated documents, malformed JSON, non-feed XML and entity declarations", () => {
    expect(() => readPageResponse({ ...response("hello"), truncated: true }, target)).toThrow(/taille/);
    for (const [body, mime] of [["{", "application/json"], ["<root/>", "text/xml"], ['<!DOCTYPE rss SYSTEM "http://internal/"><rss/>', "text/xml"]]) {
      expect(() => readPageResponse(response(body!, mime!), target)).toThrow();
    }
  });
  it("keeps JSON text inert and canonicalizes object order", () => {
    const a = readPageResponse(response('{"a":"<script>evil()</script>","b":2}', "application/json"), target);
    const b = readPageResponse(response('{"b":2,"a":"<script>evil()</script>"}', "application/json"), target);
    expect(a.observation.textHash).toBe(b.observation.textHash);
    expect(a.observation.excerpt).toContain("<script>evil()</script>");
    expect(a.html).toBeNull();
  });
  it("rejects MIME prefix spoofing", () => {
    expect(PAGE_CONTENT_TYPES.test("application/json-malicious")).toBe(false);
    expect(PAGE_CONTENT_TYPES.test("application/rss+xml; charset=utf-8")).toBe(true);
  });
  it.each([{}, { "cache-control": "no-store, max-age=900" }, { "cache-control": "private, max-age=900" }, { "cache-control": "no-cache, max-age=900" }, { "cache-control": "max-age=900", "set-cookie": "session=abc" }, { "cache-control": "max-age=900", vary: "Cookie" }])("does not share restricted or unspecified responses: %j", (headers) => {
    expect(sharedCacheTtl(headers, 900)).toBe(0);
  });
  it("bounds cache freshness by source lifetime and Age", () => {
    expect(sharedCacheTtl({ "cache-control": "public, max-age=60", age: "20" }, 900)).toBe(40);
    expect(sharedCacheTtl({ "cache-control": "max-age=600, s-maxage=30" }, 900)).toBe(30);
    expect(sharedCacheTtl({ "cache-control": "max-age=600" }, 10)).toBe(10);
  });
});
