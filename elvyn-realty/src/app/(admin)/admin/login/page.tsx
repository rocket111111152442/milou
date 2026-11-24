import { redirect } from "next/navigation";
import { Logo } from "@/components/site/Logo";
import { getAdmin } from "@/lib/auth/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Acceso" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin().catch(() => null)) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-7 shadow-card">
        <Logo className="mx-auto max-h-14" />
        <h1 className="mt-6 text-center text-xl font-semibold">Espacio privado</h1>
        <p className="mt-1 text-center text-sm text-ink-muted">CRM de Elvyn Arnaud Realty Group</p>
        <div className="mt-6"><LoginForm /></div>
      </div>
    </main>
  );
}
