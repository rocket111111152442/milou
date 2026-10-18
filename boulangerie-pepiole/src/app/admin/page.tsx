import type { Metadata } from "next";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { listOrders, storageEnabled, type StoredOrder } from "@/lib/orders-store";
import { ordersEnabled } from "@/lib/order-config";
import { SHOPS } from "@/lib/shops";
import { AdminDashboard } from "./AdminDashboard";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Commandes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <Shell>
        <h1 className="font-display text-4xl">Espace commandes</h1>
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

  let orders: StoredOrder[] = [];
  let error: string | null = null;
  if (!storageEnabled()) error = "Le stockage des commandes n'est pas configuré (BLOB_READ_WRITE_TOKEN manquant).";
  else {
    try {
      orders = await listOrders();
    } catch (e) {
      error = `Impossible de lire les commandes : ${(e as Error).message}`;
    }
  }

  return (
    <AdminDashboard
      orders={orders}
      error={error}
      liveShops={SHOPS.filter((s) => ordersEnabled(s.id)).map((s) => s.id)}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid min-h-screen place-items-center bg-farine px-6 py-24">
      <div className="w-full max-w-md rounded-[2rem] bg-creme p-8 ring-1 ring-mie sm:p-10">{children}</div>
    </section>
  );
}
