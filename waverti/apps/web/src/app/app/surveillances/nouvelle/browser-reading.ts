import { z } from "zod";

const prefix = "#waverti-releve=";
const readingSchema = z.object({
  version: z.literal(1),
  url: z.string().regex(/^https:\/\/www\.amazon\.fr\/dp\/[A-Z0-9]{10}$/),
  price: z.number().positive().max(100_000_000).nullable(),
  currency: z.literal("EUR").nullable(),
  availability: z.enum(["in_stock", "out_of_stock", "preorder", "unknown"]),
  observedAt: z.iso.datetime(),
}).strict();

export type BrowserReading = z.infer<typeof readingSchema>;

export function readBrowserReading(hash: string, now = Date.now()): BrowserReading | "invalid" | null {
  if (!hash.startsWith(prefix)) return null;
  if (hash.length > 1500) return "invalid";

  try {
    const result = readingSchema.safeParse(JSON.parse(decodeURIComponent(hash.slice(prefix.length))));
    if (!result.success) return "invalid";
    const reading = result.data;
    const age = now - Date.parse(reading.observedAt);
    if (age < -60_000 || age > 60 * 60_000) return "invalid";
    if ((reading.price === null) !== (reading.currency === null)) return "invalid";
    if (reading.price === null && reading.availability === "unknown") return "invalid";
    return reading;
  } catch {
    return "invalid";
  }
}
