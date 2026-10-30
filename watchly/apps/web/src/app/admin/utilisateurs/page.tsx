import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, Input, PageHeader } from "@watchly/ui";
import { formatDateTime, formatRelative } from "@watchly/types";
import { searchUsers } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Utilisateurs" };

const STATUS: Record<string, string> = { active: "Actif", trialing: "Essai", past_due: "Impayé", canceled: "Résilié", unpaid: "Impayé", incomplete: "Incomplet", incomplete_expired: "Expiré", paused: "En pause" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const users = await searchUsers(q.slice(0, 120));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Utilisateurs" description="Recherche par adresse e-mail ou identifiant." />
      <form className="flex max-w-xl gap-2" role="search">
        <Input name="q" type="search" defaultValue={q} placeholder="adresse@exemple.fr" aria-label="Rechercher un utilisateur" />
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Comptes utilisateurs</caption>
          <thead>
            <tr className="border-b border-line bg-surface text-left">
              <th scope="col" className="px-4 py-3">Compte</th>
              <th scope="col" className="px-4 py-3">Formule</th>
              <th scope="col" className="px-4 py-3">Inscription</th>
              <th scope="col" className="px-4 py-3">Dernière activité</th>
              <th scope="col" className="px-4 py-3">État</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <Link href={`/admin/utilisateurs/${u.id}`} className="text-blue hover:underline">
                    {u.email}
                  </Link>
                  {u.role !== "user" ? <Badge className="ml-2">{u.role}</Badge> : null}
                </th>
                <td className="px-4 py-3">{u.plan_id && u.sub_status ? `${u.plan_id} · ${STATUS[u.sub_status] ?? u.sub_status}` : "Sans abonnement"}</td>
                <td className="px-4 py-3">{formatDateTime(u.created_at)}</td>
                <td className="px-4 py-3">{u.last_seen_at ? formatRelative(new Date(u.last_seen_at).toISOString()) : "—"}</td>
                <td className="px-4 py-3">{u.suspended_at ? <Badge tone="danger">Suspendu</Badge> : <Badge tone="success">Actif</Badge>}</td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-fg">
                  Aucun compte trouvé.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
