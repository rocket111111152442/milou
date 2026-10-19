import Link from "@/components/TLink";

export default function NotFound() {
  return (
    <section className="grid min-h-[80vh] place-items-center bg-farine px-6 pt-24 text-center">
      <div>
        <p className="font-display text-[clamp(6rem,22vw,14rem)] leading-none text-outline text-croute">404</p>
        <h1 className="font-display text-4xl tracking-tight">Cette page n&apos;est pas sortie du four.</h1>
        <p className="mt-3 text-cafe/70">Elle a peut-être été mangée. Revenons à quelque chose de croustillant.</p>
        <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-cafe px-7 font-semibold text-creme transition hover:bg-croute">
          Retour à l&apos;accueil
        </Link>
      </div>
    </section>
  );
}
