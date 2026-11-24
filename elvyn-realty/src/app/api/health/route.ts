import { NextResponse } from "next/server";
import { catalogMode } from "@/config/env";
import { assistantAvailable } from "@/lib/ai/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public health check: configuration states only, no secrets or data. */
export async function GET() {
  return NextResponse.json({ ok: true, catalog: catalogMode(), assistant: assistantAvailable().ok ? "on" : "off" });
}
