import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { aeListingDetail } from "@/lib/alterestate/schemas";
import { env } from "@/config/env";
import { normalizeDetail } from "./normalize";
import type { ListingDetail } from "./types";

/**
 * Demonstration catalogue used only while ALTERESTATE_PUBLIC_TOKEN is not configured.
 * data/demo/listings.json is a capture of the public pages of elvynarnaudrealty.com taken on
 * 24/11/2026. It is NOT synchronised: availability and prices may have changed since.
 */
export const DEMO_CAPTURED_AT = "2026-11-24";
let cached: ListingDetail[] | null = null;

export async function loadDemoDetails(): Promise<ListingDetail[]> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data/demo/listings.json");
  const doc = JSON.parse(await readFile(file, "utf8")) as { results: unknown[] };
  cached = doc.results.flatMap((r) => {
    const parsed = aeListingDetail.safeParse(r);
    return parsed.success ? [normalizeDetail(parsed.data, env.alterestate.companyId)] : [];
  });
  return cached;
}
