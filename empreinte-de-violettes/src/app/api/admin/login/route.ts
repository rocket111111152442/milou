import { NextResponse } from "next/server";
import { checkPassword, createSession, sessionCookie } from "@/lib/auth";

// Limitation simple des tentatives (par instance).
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !(await checkPassword(password))) {
    const n = (a?.n || 0) + 1;
    attempts.set(ip, { n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 });
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(await createSession()));
  return res;
}
