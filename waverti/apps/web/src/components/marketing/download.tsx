import Link from "next/link";
import { Apple, Globe, Monitor, Terminal, Download, ShieldAlert } from "lucide-react";
import { Badge, Button, Container, SectionHeading } from "@waverti/ui";
import type { PublicRelease } from "@/lib/releases";

const platforms = [
  { id: "windows" as const, name: "Windows", icon: <Monitor />, req: "Windows 10 ou 11 (64 bits)" },
  { id: "macos" as const, name: "macOS", icon: <Apple />, req: "macOS 11 Big Sur ou plus récent" },
  { id: "linux" as const, name: "Linux", icon: <Terminal />, req: "Debian, Ubuntu et dérivés (x86_64)" },
];

const PACKAGE_LABEL: Record<string, string> = { nsis: "Installateur (.exe)", msi: "Installateur (.msi)", deb: "Paquet .deb", dmg: "Image disque (.dmg)", appimage: "AppImage", rpm: "Paquet .rpm" };
const ARCH_LABEL: Record<string, string> = { x86_64: "64 bits Intel/AMD", aarch64: "Apple Silicon", universal: "Intel et Apple Silicon" };

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

export function DownloadSection({ releases, standalone = false }: { releases: PublicRelease[]; standalone?: boolean }) {
  return (
    <section id="telecharger" aria-labelledby="download-title" className="py-24 sm:py-32">
      <Container>
        <SectionHeading
          as={standalone ? "h1" : "h2"}
          id="download-title"
          eyebrow="Télécharger"
          title="Waverti sur votre ordinateur"
          description="L'application desktop effectue vos contrôles locaux et vous envoie des notifications natives. Elle partage le même compte que la version navigateur."
        />
        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {platforms.map((p) => {
            const rel = releases.filter((r) => r.platform === p.id);
            const latest = rel[0];
            return (
              <li key={p.id} className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-7">
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-surface [&_svg]:size-6">{p.icon}</span>
                  {latest ? <Badge tone="success">v{latest.version}</Badge> : <Badge tone="neutral">Bientôt disponible</Badge>}
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-fg">{p.req}</p>
                </div>
                {latest ? (
                  <div className="mt-auto flex flex-col gap-2">
                    {rel.map((r) => (
                      <Button key={`${r.packageType}-${r.arch}`} asChild variant="secondary">
                        <a href={r.url} rel="noopener">
                          <Download aria-hidden="true" /> {PACKAGE_LABEL[r.packageType] ?? r.packageType.toUpperCase()}
                          {p.id === "macos" ? ` · ${ARCH_LABEL[r.arch] ?? r.arch}` : ""}
                          {formatSize(r.sizeBytes) ? ` · ${formatSize(r.sizeBytes)}` : ""}
                        </a>
                      </Button>
                    ))}
                    {!latest.codeSigned ? (
                      <p className="flex gap-1.5 text-xs text-warning">
                        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> Version bêta non signée : votre
                        système affichera un avertissement
                        {p.id === "windows" ? " (SmartScreen : « Informations complémentaires » puis « Exécuter quand même »)" : ""}
                        {p.id === "macos" ? " (Gatekeeper : clic droit sur l'application puis « Ouvrir »)" : ""}.
                      </p>
                    ) : null}
                    {latest.testedOn ? <p className="text-[11px] text-muted-fg">Testé : {latest.testedOn}.</p> : null}
                    {rel.map((r) => (
                      <p key={`sha-${r.packageType}-${r.arch}`} className="break-all text-[11px] text-muted-fg">
                        SHA-256 ({PACKAGE_LABEL[r.packageType] ?? r.packageType}) : {r.sha256}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-auto rounded-xl bg-surface p-3 text-sm text-muted-fg">
                    Aucune version testée n'est encore publiée pour {p.name}. Nous n'affichons un téléchargement que lorsqu'un
                    installateur vérifié existe.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-muted-fg">Pas d'ordinateur compatible ? Toutes les fonctions de compte sont disponibles dans le navigateur.</p>
          <Button asChild variant="gradient">
            <Link href="/inscription">
              <Globe aria-hidden="true" /> Utiliser la version navigateur
            </Link>
          </Button>
          {!standalone ? (
            <Link href="/telecharger" className="text-sm font-medium text-blue hover:underline">
              Instructions d'installation
            </Link>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
