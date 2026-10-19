import { getFile } from "@/lib/store";

export const runtime = "nodejs";

// Photos envoyées depuis le Studio (façade, boutique, ambiance) : stockées dans le Blob privé, servies ici.
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(name)) return new Response("Introuvable", { status: 404 });
  const file = await getFile(`gphotos/${name}`).catch(() => null);
  if (!file) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
