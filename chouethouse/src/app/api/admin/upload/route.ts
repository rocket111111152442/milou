import { NextResponse } from "next/server";
import { guard } from "@/lib/adminApi";
import { uploadMedia } from "@/lib/store";

const MAX = 4 * 1024 * 1024; // limite des fonctions Vercel ~4,5 Mo

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Image uniquement" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Image trop lourde (4 Mo max)" }, { status: 400 });
  const url = await uploadMedia(file);
  return NextResponse.json({ url });
}
