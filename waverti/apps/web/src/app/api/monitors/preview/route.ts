import { z } from "zod";
import { previewPage, RobotsCache } from "@waverti/monitoring";
import { json, readJson, withActor } from "@/lib/api";

const robots = new RobotsCache();

/** Contrôle initial sans enregistrement : prix/disponibilité détectés, pour valider la cible avant création. */
export const POST = withActor(
  async (req) => {
    const body = await readJson(req, z.object({ url: z.string().trim().url().max(2048), cssSelector: z.string().trim().max(300).optional() }));
    if (!body.ok) return body.res;
    const r = await previewPage({ url: body.data.url, cssSelector: body.data.cssSelector ?? null, renderMode: "http" }, {}, robots);
    if (r.error) return json({ ok: false, error: r.error }, 200);
    const o = r.observation!;
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
    });
  },
  { allowDevice: true, rate: { name: "preview", limit: 20, windowSec: 3600 } },
);
