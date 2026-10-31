import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/api";
import { endSession, isAuthConfigured } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  if (isAuthConfigured()) await endSession();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
