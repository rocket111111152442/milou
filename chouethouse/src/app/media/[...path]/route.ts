import { readMedia } from "@/lib/store";

/** Sert les images envoyées depuis l'admin (stockées dans le Blob privé) */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathname = path.join("/");
  if (!pathname.startsWith("uploads/") || pathname.includes("..")) return new Response("Not found", { status: 404 });
  const file = await readMedia(pathname);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
