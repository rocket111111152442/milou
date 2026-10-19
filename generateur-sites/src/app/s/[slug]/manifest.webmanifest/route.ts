import { getTenant } from "@/lib/tenant-store";
import { PALETTES, siteOf, publicTenant, copyOf } from "@/lib/tenant";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return new Response("Introuvable", { status: 404 });
  const pub = publicTenant(tenant);
  const v = (PALETTES[tenant.palette] ?? PALETTES.ble).vars;
  return Response.json(
    {
      name: siteOf(pub).name,
      short_name: tenant.name.slice(0, 12),
      description: copyOf(pub).siteDescription,
      start_url: `/s/${slug}`,
      scope: `/s/${slug}/`,
      display: "standalone",
      background_color: v.farine,
      theme_color: v.torref,
      icons: [{ src: `/s/${slug}/icon.png`, sizes: "192x192", type: "image/png" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
