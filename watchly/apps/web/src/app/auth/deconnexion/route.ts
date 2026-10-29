import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/api";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  if (isAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
