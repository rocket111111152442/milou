import type { Metadata, Viewport } from "next";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { LoginForm } from "./LoginForm";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Espace boutiques",
  robots: { index: false, follow: false },
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "Commandes", statusBarStyle: "black-translucent" },
  icons: { apple: "/admin-icon.png" },
};

export const viewport: Viewport = { themeColor: "#24160d" };

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid min-h-screen place-items-center bg-farine px-6 py-24">
      <div className="w-full max-w-md rounded-[2rem] bg-creme p-8 ring-1 ring-mie sm:p-10">{children}</div>
    </section>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!adminConfigured()) {
    return (
      <Shell>
        <h1 className="font-display text-4xl">Espace boutiques</h1>
        <p className="mt-4 text-cafe/70">
          L&apos;accès n&apos;est pas encore configuré : ajoutez la variable <code>ADMIN_PASSWORD</code> dans Vercel.
        </p>
      </Shell>
    );
  }
  if (!(await isAdmin())) {
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
