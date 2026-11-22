import Link from "next/link";
import { getActivities, getPosts, getRequests } from "@/lib/store";
import { formatDate, formatTime, todayISO } from "@/lib/format";

export default async function AdminHome() {
  const [activities, posts, requests] = await Promise.all([getActivities({ includeDrafts: true }), getPosts({ includeDrafts: true }), getRequests()]);
  const today = todayISO();
  const upcoming = activities
    .flatMap((a) => a.sessions.filter((s) => s.date >= today).map((s) => ({ a, s })))
    .sort((x, y) => (x.s.date + x.s.start).localeCompare(y.s.date + y.s.start))
    .slice(0, 8);
  const fresh = requests.filter((r) => r.status === "nouveau");
  const storage = process.env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob (privé)" : "Fichiers locaux (.data) – mode développement";

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-4xl">Bonjour 👋</h1>
      <p className="mt-1 text-ink-soft">Gérez ici les activités, les horaires, le blog et les demandes reçues.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { n: activities.filter((a) => a.published).length, l: "activités en ligne", href: "/admin/activites", c: "bg-mint" },
          { n: posts.filter((p) => p.published).length, l: "articles publiés", href: "/admin/blog", c: "bg-butter" },
          { n: fresh.length, l: "nouvelles demandes", href: "/admin/demandes", c: fresh.length ? "bg-tomato text-white" : "bg-shell" },
        ].map((k) => (
          <Link key={k.l} href={k.href} className={`${k.c} rounded-3xl p-6 transition hover:-translate-y-1`}>
            <p className="font-display text-5xl font-bold">{k.n}</p>
            <p className="font-bold">{k.l}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl">Prochaines séances</h2>
            <Link href="/admin/activites" className="font-bold text-tomato">Gérer →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-ink-soft">Aucune séance programmée. Ajoutez des dates dans « Activités & horaires ».</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/5">
              {upcoming.map(({ a, s }) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="block font-bold">{a.title}</span>
                    <span className="text-sm text-ink-soft capitalize">{formatDate(s.date)} · {formatTime(s.start)}</span>
                  </span>
                  {typeof s.spots === "number" && <span className="rounded-full bg-mint px-3 py-1 text-sm font-bold">{s.spots} pl.</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl">Dernières demandes</h2>
            <Link href="/admin/demandes" className="font-bold text-tomato">Tout voir →</Link>
          </div>
          {requests.length === 0 ? (
            <p className="mt-4 text-ink-soft">Aucune demande pour le moment.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/5">
              {requests.slice(0, 6).map((r) => (
                <li key={r.id} className="py-3">
                  <span className="font-bold">{r.name}</span> <span className="text-sm text-ink-soft">· {r.type} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                  {r.status === "nouveau" && <span className="ml-2 rounded-full bg-tomato px-2 py-0.5 text-xs font-bold text-white">nouveau</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-8 text-xs text-ink-soft">Stockage : {storage}</p>
    </div>
  );
}
