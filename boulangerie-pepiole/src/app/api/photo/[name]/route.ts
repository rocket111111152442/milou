import { readPhoto } from "@/lib/photos-store";

export const runtime = "nodejs";

// Sert les photos des produits ajoutés depuis /admin (stockées dans la base).
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(name)) return new Response("Introuvable", { status: 404 });
  try {
    const file = await readPhoto(name);
    if (!file) return new Response("Introuvable", { status: 404 });
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType,
        // Noms uniques : la photo ne change jamais
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
