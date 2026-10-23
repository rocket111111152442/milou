import { AdminShell } from "@/components/admin/AdminShell";
import { usingDefaultPassword } from "@/lib/auth";
import { list, storageInfo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [orders, messages] = await Promise.all([list("orders"), list("messages")]);
  const storage = storageInfo();
  const warnings: string[] = [];
  if (!storage.persistent)
    warnings.push("Stockage temporaire (démo) : les modifications peuvent être perdues au redémarrage du serveur. Connectez une base Upstash Redis (gratuite) dans Vercel pour les conserver — voir Paramètres.");
  if (usingDefaultPassword()) warnings.push("Le mot de passe d'administration par défaut est utilisé. Définissez ADMIN_PASSWORD et AUTH_SECRET dans les variables d'environnement.");
  return (
    <AdminShell
      counts={{ orders: orders.filter((o) => o.status === "paid").length, messages: messages.filter((m) => m.status === "new").length }}
      warnings={warnings}
    >
      {children}
    </AdminShell>
  );
}
