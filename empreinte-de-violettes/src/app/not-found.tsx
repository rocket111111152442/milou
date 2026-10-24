import Link from "next/link";
import { Plate } from "@/components/herbier/Plate";

export default function NotFound() {
  return (
    <main className="h-paper flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center">
      <Plate name="brins" reveal="mount" duration={1.8} className="w-[min(420px,80vw)] text-plum" />
      <p className="sc mt-12 text-ink-muted">Planche manquante · erreur 404</p>
      <h1 className="h-title mt-5">
        Cette page <em>manque à l&apos;herbier</em>
      </h1>
      <p className="body-text mt-6 max-w-md">Elle a peut-être été déplacée, ou n&apos;a jamais été cueillie. Reprenons depuis le sommaire.</p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
        <Link href="/" className="btn-label">
          <span>Retour à l&apos;accueil</span>
        </Link>
        <Link href="/boutique" className="btn-line">
          La boutique <span className="arrow">→</span>
        </Link>
      </div>
    </main>
  );
}
