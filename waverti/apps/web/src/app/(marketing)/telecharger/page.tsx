import type { Metadata } from "next";
import { Container } from "@waverti/ui";
import { DownloadSection } from "@/components/marketing/download";
import { getPublishedReleases } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Télécharger l'application",
  description: "Application Waverti pour Windows, macOS et Linux : installation, liaison au compte et vérification des fichiers.",
  alternates: { canonical: "/telecharger" },
};

export const revalidate = 600;

const steps = [
  {
    title: "1. Téléchargez l'installateur",
    text: "Choisissez le fichier correspondant à votre système. Vérifiez si besoin son empreinte SHA-256 affichée sous le bouton.",
  },
  {
    title: "2. Installez et ouvrez Waverti",
    text: "Windows : exécutez le fichier .msi. macOS : ouvrez le .dmg et glissez Waverti dans Applications. Linux : rendez l'AppImage exécutable ou installez le paquet .deb.",
  },
  {
    title: "3. Reliez l'application à votre compte",
    text: "L'application affiche un code. Validez-le depuis votre navigateur, connecté à votre compte : aucun mot de passe n'est saisi dans l'application.",
  },
  {
    title: "4. Acceptez le fonctionnement local",
    text: "Lisez l'explication et cochez la case d'acceptation pour activer les contrôles sur votre ordinateur. Vous pouvez la retirer à tout moment.",
  },
];

export default async function TelechargerPage() {
  const releases = await getPublishedReleases();
  return (
    <>
      <DownloadSection releases={releases} standalone />
      <section aria-labelledby="install-title" className="border-t border-line bg-surface py-20">
        <Container className="flex flex-col gap-10">
          <h2 id="install-title" className="font-display text-3xl font-bold tracking-tight">
            Instructions d'installation
          </h2>
          <ol className="grid gap-5 md:grid-cols-2">
            {steps.map((s) => (
              <li key={s.title} className="rounded-2xl border border-line bg-white p-6">
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-fg">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="rounded-2xl border border-line bg-white p-6 text-sm leading-relaxed text-muted-fg">
            <h3 className="font-display text-base font-semibold text-ink">Désinstallation</h3>
            <p className="mt-2">
              Windows : Paramètres › Applications › Waverti › Désinstaller. macOS : quittez Waverti puis placez-le dans la
              corbeille. Linux : supprimez l'AppImage ou exécutez <code className="rounded bg-surface px-1">sudo apt remove waverti</code>.
              La désinstallation révoque l'accès local ; l'appareil peut aussi être révoqué depuis vos paramètres en ligne.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
