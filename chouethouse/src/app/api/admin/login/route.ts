import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, cookieOptions, createToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  // petit délai pour freiner les essais en série
  await new Promise((r) => setTimeout(r, 600));
  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createToken(), cookieOptions);
  return res;
}
