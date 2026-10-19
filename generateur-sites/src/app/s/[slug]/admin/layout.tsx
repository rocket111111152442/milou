import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSiteAdmin } from "@/lib/auth";
import { getTenantFresh } from "@/lib/tenant-store";
import { LoginForm } from "./LoginForm";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Espace boutiques",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Commandes", statusBarStyle: "black-translucent" },
};

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid min-h-screen place-items-center bg-farine px-6 py-24">
      <div className="w-full max-w-md rounded-[2rem] bg-creme p-8 ring-1 ring-mie sm:p-10">{children}</div>
    </section>
  );
}

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantFresh(slug);
  if (!tenant) notFound();
  if (!(await isSiteAdmin(slug, tenant.passwordHash))) {
    return (
      <Shell>
        <LoginForm />
      </Shell>
    );
  }
  return (
    <div className="min-h-screen bg-farine print:bg-white">
      <AdminNav />
      {children}
    </div>
  );
}
