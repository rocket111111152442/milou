import "server-only";
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const CHAT_COOKIE = "ea_chat";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function readChatId(req: NextRequest): string | null {
  const v = req.cookies.get(CHAT_COOKIE)?.value;
  return v && UUID_RE.test(v) ? v : null;
}
export const newChatId = () => randomUUID();

export function setChatCookie(res: NextResponse, id: string, days: number) {
  res.cookies.set(CHAT_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: days * 86400 });
}
