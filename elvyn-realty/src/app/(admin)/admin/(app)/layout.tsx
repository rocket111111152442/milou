import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { catalogMode, env } from "@/config/env";
import { Logo } from "@/components/site/Logo";
import { logout } from "../actions";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-navy-100 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 p-4 lg:block">
          <Link href="/admin" aria-label="Inicio del CRM"><Logo className="max-h-10" /></Link>
          <p className="hidden text-xs text-ink-soft lg:mt-2 lg:block">Sesión: {admin.name}</p>
        </div>
        <AdminNav />
        <div className="hidden space-y-2 p-4 text-xs lg:block">
          {catalogMode() === "demo" && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">Catálogo en modo demostración</p>}
          {env.notify.mode === "test" && <p className="rounded-lg bg-sky-50 p-2 text-sky-900">Notificaciones en modo prueba (no se envían)</p>}
          <form action={logout}><button className="btn-outline min-h-[38px] w-full text-xs">Cerrar sesión</button></form>
          <Link href="/" className="block text-center text-ink-muted hover:underline">Ver el sitio</Link>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
