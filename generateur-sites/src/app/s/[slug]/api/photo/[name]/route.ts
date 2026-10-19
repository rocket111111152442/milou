import { readPhoto } from "@/lib/tenant-store";

export const runtime = "nodejs";

// Sert les photos téléversées pour un site (stockées dans le Blob privé du site).
export async function GET(_: Request, { params }: { params: Promise<{ slug: string; name: string }> }) {
  const { slug, name } = await params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+\.(jpg|png|webp)$/.test(name)) return new Response("Introuvable", { status: 404 });
  const file = await readPhoto(slug, name).catch(() => null);
  if (!file) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      // Noms uniques : la photo ne change jamais
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
