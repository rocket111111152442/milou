import Link from "next/link";
import { Logo } from "@waverti/ui";
import { siteConfig } from "@/lib/site";

const columns = [
  {
    title: "Produit",
    links: [
      { href: "/#fonctionnalites", label: "Fonctionnalités" },
      { href: "/tarifs", label: "Tarifs" },
      { href: "/telecharger", label: "Téléchargements" },
      { href: "/entreprises", label: "Entreprises" },
    ],
  },
  {
    title: "Cas d'usage",
    links: [
      { href: "/surveiller-prix-produit", label: "Surveiller un prix" },
      { href: "/alerte-retour-en-stock", label: "Alerte retour en stock" },
      { href: "/surveiller-changements-site", label: "Changements d'un site" },
      { href: "/detecter-panne-site-internet", label: "Détecter une panne" },
      { href: "/surveillance-site-entreprise", label: "Surveillance pour entreprises" },
    ],
  },
  {
    title: "Aide",
    links: [
      { href: "/assistance", label: "Assistance" },
      { href: "/#faq", label: "Questions fréquentes" },
      { href: "/robot", label: "Notre robot d'exploration" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/legal/conditions-generales", label: "Conditions générales" },
      { href: "/legal/confidentialite", label: "Confidentialité" },
      { href: "/legal/cookies", label: "Cookies" },
      { href: "/legal/mentions-legales", label: "Mentions légales" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-fg">
              L'assistant qui surveille Internet pour vous : prix, stocks, annonces, nouveautés et disponibilité de vos
              sites.
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">{col.title}</h2>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted-fg transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-8 text-sm text-muted-fg sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold text-ink">WAVERTI</span> — Développé par{" "}
            <a href={siteConfig.publisherUrl} className="font-medium text-ink underline-offset-4 hover:underline" rel="noopener">
              LULLIN WEB
            </a>
          </p>
          <p>© {new Date().getFullYear()} LULLIN WEB. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
