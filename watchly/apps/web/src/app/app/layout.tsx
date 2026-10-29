import type { Metadata } from "next";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { unreadCount } from "@/lib/data/account";
import { DashboardShell } from "./shell";

export const metadata: Metadata = { title: { default: "Tableau de bord", template: "%s · Watchly" }, robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app");
  const [unread] = await Promise.all([unreadCount(user.id).catch(() => 0)]);
  const current = await getCurrentUser();
  return (
    <DashboardShell email={user.email} displayName={user.displayName} isAdmin={current?.role === "admin"} unread={unread}>
      {children}
    </DashboardShell>
  );
}
