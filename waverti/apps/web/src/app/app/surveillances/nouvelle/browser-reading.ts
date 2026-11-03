import { z } from "zod";

const prefix = "#waverti-releve=";
const readingFields = {
  price: z.number().positive().max(100_000_000).nullable(),
  availability: z.enum(["in_stock", "out_of_stock", "preorder", "unknown"]),
  observedAt: z.iso.datetime(),
};

function isWebUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || /[\s\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname && !url.username && !url.password);
  } catch {
    return false;
  }
}

const readingSchema = z.discriminatedUnion("version", [
  z.object({
    ...readingFields,
    version: z.literal(1),
    url: z.string().regex(/^https:\/\/www\.amazon\.fr\/dp\/[A-Z0-9]{10}$/),
    currency: z.literal("EUR").nullable(),
  }).strict(),
  z.object({
    ...readingFields,
    version: z.literal(2),
    url: z.string().max(2048).refine(isWebUrl),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  }).strict(),
]);

export type BrowserReading = z.infer<typeof readingSchema>;

export function hasBrowserOffer(reading: BrowserReading): boolean {
  return reading.price !== null || reading.availability !== "unknown";
}

export function readBrowserReading(hash: string, now = Date.now()): BrowserReading | "invalid" | null {
  if (!hash.startsWith(prefix)) return null;
  if (hash.length > 8000) return "invalid";

  try {
    const result = readingSchema.safeParse(JSON.parse(decodeURIComponent(hash.slice(prefix.length))));
    if (!result.success) return "invalid";
    const reading = result.data;
    const age = now - Date.parse(reading.observedAt);
    if (age < -60_000 || age > 60 * 60_000) return "invalid";
    if ((reading.price === null) !== (reading.currency === null)) return "invalid";
    if (reading.version === 1 && !hasBrowserOffer(reading)) return "invalid";
    return reading;
  } catch {
    return "invalid";
  }
}
