import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { getDoc, setDoc } from "@/lib/db";
import { docSchemas, firstError } from "@/lib/validation";
import type { DocMap, DocName } from "@/lib/types";

export const dynamic = "force-dynamic";

const isDoc = (d: string): d is DocName => d in docSchemas;

export async function GET(_: Request, { params }: { params: Promise<{ doc: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { doc } = await params;
  if (!isDoc(doc)) return NextResponse.json({ error: "Document inconnu" }, { status: 404 });
  return NextResponse.json({ doc: await getDoc(doc) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ doc: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { doc } = await params;
  if (!isDoc(doc)) return NextResponse.json({ error: "Document inconnu" }, { status: 404 });
  const parsed = docSchemas[doc].safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  await setDoc(doc, parsed.data as DocMap[typeof doc]);
  revalidatePath("/", "layout");
  return NextResponse.json({ doc: parsed.data });
}
