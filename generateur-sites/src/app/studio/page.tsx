import Link from "next/link";
import { headers } from "next/headers";
import { listTenants } from "@/lib/tenant-store";
import { KINDS, PALETTES } from "@/lib/tenant";
import { SiteCard } from "./SiteCard";

export default async function StudioHome() {
  const tenants = await listTenants();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Vos sites</h1>
          <p className="mt-1 max-w-xl text-sm text-cafe/70">
            Saisissez les informations d&apos;un commerce : le site complet (accueil animé, carte, commande en ligne, espace boutiques)
            est généré en quelques secondes et reste modifiable ensuite.
          </p>
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="mt-10 rounded-[2rem] bg-creme p-12 text-center ring-1 ring-mie">
          <p className="text-5xl">🥖</p>
          <p className="mt-4 font-display text-2xl">Aucun site pour l&apos;instant</p>
          <p className="mt-1 text-sm text-grege">Créez le premier en moins de dix minutes.</p>
          <Link href="/studio/new" className="mt-6 inline-flex h-12 items-center rounded-full bg-croute px-7 font-semibold text-creme transition hover:bg-cafe">
            + Générer un site
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {tenants.map((t) => (
            <SiteCard
              key={t.slug}
              origin={origin}
              slug={t.slug}
              name={t.name}
              kind={KINDS.find((k) => k.id === t.kind)?.label ?? ""}
              cities={[...new Set(t.shops.map((s) => s.city))]}
              productCount={t.products.length}
              createdAt={t.createdAt}
              swatch={[PALETTES[t.palette]?.vars.croute ?? "#b5652b", PALETTES[t.palette]?.vars.dore ?? "#e8b860", PALETTES[t.palette]?.vars.torref ?? "#24160d"]}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
