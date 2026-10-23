import { NextResponse } from "next/server";
import { getDoc, newId, put } from "@/lib/db";
import { messageNotificationEmail, sendEmail } from "@/lib/email";
import { contactSchema, firstError } from "@/lib/validation";
import type { Message } from "@/lib/types";

export async function POST(req: Request) {
  const parsed = contactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const { website, ...data } = parsed.data;
  if (website) return NextResponse.json({ ok: true }); // robot
  const msg: Message = { id: newId("msg"), ...data, status: "new", createdAt: new Date().toISOString() };
  await put("messages", msg);
  const settings = await getDoc("settings");
  const mail = messageNotificationEmail(msg, settings);
  await sendEmail({ to: settings.notifyEmail, subject: mail.subject, html: mail.html, replyTo: msg.email });
  return NextResponse.json({ ok: true });
}
