import { NextResponse } from "next/server";
import { getDoc, list } from "@/lib/db";
import { availability } from "@/lib/delivery";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode");
  if (mode !== "delivery" && mode !== "pickup" && mode !== "drive") return NextResponse.json({ error: "mode" }, { status: 400 });
  const [delivery, settings, orders] = await Promise.all([getDoc("delivery"), getDoc("settings"), list("orders")]);
  return NextResponse.json({ days: availability(delivery, settings, mode, orders, 28) });
}
