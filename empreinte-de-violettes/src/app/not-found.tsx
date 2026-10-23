import Link from "next/link";
import { Petals } from "@/components/motion/Petals";
import { VioletMark } from "@/components/site/Logo";

export default function NotFound() {
  return (
    <main className="fern-night relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-noir px-6 text-center text-ivory">
      <Petals count={30} />
      <VioletMark className="relative h-20 w-20 animate-floaty text-gold" strokeWidth={1} />
      <p className="eyebrow relative mt-10 text-gold">Erreur 404</p>
      <h1 className="h-display relative mt-5 text-[clamp(3rem,8vw,7rem)]">
        Cette page s&apos;est <em className="text-foil">envolée</em>
      </h1>
      <p className="relative mt-6 max-w-md text-ivory/60">Comme un pétale emporté par le mistral… Revenons au jardin.</p>
      <div className="relative mt-10 flex flex-wrap justify-center gap-4">
        <Link href="/" className="btn btn-gold">
          <span>Retour à l&apos;accueil</span>
        </Link>
        <Link href="/boutique" className="btn btn-ghost text-ivory">
          <span>La boutique</span>
        </Link>
      </div>
    </main>
  );
}
