import { NextResponse } from "next/server";
import { guard } from "@/lib/adminApi";
import { deleteRequest, getRequests, updateRequest } from "@/lib/store";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json(await getRequests());
}

export async function PATCH(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { id, status } = (await req.json()) as { id: string; status: "nouveau" | "traite" };
  await updateRequest(id, { status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  await deleteRequest(id);
  return NextResponse.json({ ok: true });
}
