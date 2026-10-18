import { get } from "@vercel/blob";

export const runtime = "nodejs";

// Sert les photos des produits ajoutés depuis /admin (stockées dans le Blob privé).
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(name)) return new Response("Introuvable", { status: 404 });
  try {
    const res = await get(`photos/${name}`, { access: "private" });
    if (!res || res.statusCode !== 200) return new Response("Introuvable", { status: 404 });
    return new Response(res.stream, {
      headers: {
        "Content-Type": res.blob.contentType,
        // Noms uniques : la photo ne change jamais
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
