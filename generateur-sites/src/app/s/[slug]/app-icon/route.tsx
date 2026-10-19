import { ImageResponse } from "next/og";
import { getTenant } from "@/lib/tenant-store";
import { PALETTES, initials } from "@/lib/tenant";

// Icône du site (monogramme sur la couleur de la maison) : onglet, écran d'accueil, notifications.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return new Response("Introuvable", { status: 404 });
  const v = (PALETTES[tenant.palette] ?? PALETTES.ble).vars;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: v.torref }}>
        <div
          style={{
            width: 132,
            height: 132,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(45deg)",
            border: `6px solid ${v.dore}`,
            borderRadius: 14,
          }}
        >
          <div style={{ transform: "rotate(-45deg)", display: "flex", color: v.dore, fontSize: 62, fontWeight: 700, fontStyle: "italic" }}>{initials(tenant.name)}</div>
        </div>
      </div>
    ),
    { width: 192, height: 192, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
