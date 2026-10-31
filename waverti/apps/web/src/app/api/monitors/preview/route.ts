import { z } from "zod";
import { listBlocks, previewPage, RobotsCache } from "@waverti/monitoring";
import { suggestRules, type PageAnalysis } from "@waverti/types";
import { json, readJson, withActor } from "@/lib/api";

const robots = new RobotsCache();

/**
 * Analyse sans enregistrement (création d'une surveillance) : données détectées, suggestions de surveillances et
 * zones sélectionnables de la page. Mêmes protections que les contrôles (SSRF, robots.txt, tailles, délais).
 */
export const POST = withActor(
  async (req) => {
    const body = await readJson(req, z.object({ url: z.string().trim().url().max(2048), cssSelector: z.string().trim().max(300).optional() }));
    if (!body.ok) return body.res;
    const r = await previewPage({ url: body.data.url, cssSelector: body.data.cssSelector ?? null, renderMode: "http" }, {}, robots);
    if (r.error) return json({ ok: false, error: r.error }, 200);
    const o = r.observation!;
    const today = new Date().toISOString().slice(0, 10);
    const analysis: PageAnalysis = {
      title: o.title,
      contentKind: o.contentKind ?? "html",
      price: o.price,
      currency: o.currency,
      regularPrice: o.regularPrice ?? null,
      availability: o.availability,
      items: (o.items ?? []).slice(0, 8).map((i) => ({ t: i.t, p: i.p ?? null })),
      documents: (o.documents ?? []).slice(0, 8),
      futureDates: (o.dates ?? []).filter((d) => d >= today).slice(0, 8),
      headings: (o.headings ?? []).slice(0, 12),
      linksCount: o.links?.length ?? 0,
      tablesCount: o.tableHashes?.length ?? 0,
      signupForm: o.forms?.signup ?? false,
      textSample: o.excerpt.slice(0, 400),
    };
    let blocks: ReturnType<typeof listBlocks> = [];
    if (r.html && !body.data.cssSelector) {
      try {
        blocks = listBlocks(r.html);
      } catch {
        blocks = [];
      }
    }
    return json({
      ok: true,
      observation: {
        title: o.title,
        price: o.price,
        currency: o.currency,
        priceSource: o.priceSource,
        availability: o.availability,
        availabilitySource: o.availabilitySource,
        selectorFound: o.selectorFound,
        httpStatus: o.httpStatus,
        finalUrl: o.finalUrl,
        excerpt: o.excerpt.slice(0, 280),
      },
      analysis,
      suggestions: suggestRules(analysis),
      blocks,
    });
  },
  { allowDevice: true, rate: { name: "preview", limit: 20, windowSec: 3600 } },
);
