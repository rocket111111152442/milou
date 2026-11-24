import { requireAdmin } from "@/lib/auth/server";
import { Card } from "@/components/admin/ui";
import { PasswordForm } from "@/components/admin/PasswordForm";

export const metadata = { title: "Mi cuenta" };

export default async function Account() {
  const admin = await requireAdmin();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">Mi cuenta</h1>
      <Card title="Datos de acceso">
        <p className="text-sm">Correo: <strong>{admin.email}</strong></p>
      </Card>
      <Card title="Cambiar contraseña">
        <PasswordForm />
      </Card>
    </div>
  );
}
