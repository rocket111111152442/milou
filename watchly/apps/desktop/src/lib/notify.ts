import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { NotificationView } from "@watchly/types";

export async function notificationsAllowed(ask = false): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    if (!ask) return false;
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Notification native du système (la notification reste aussi visible dans « Alertes »). */
export async function showDesktopNotification(n: Pick<NotificationView, "title" | "body" | "taskName">): Promise<void> {
  if (!(await notificationsAllowed())) return;
  sendNotification({ title: n.title, body: n.taskName ? `${n.taskName} — ${n.body}` : n.body });
}
