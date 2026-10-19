export default function NotFound() {
  return (
    <section className="grid min-h-[80vh] place-items-center bg-farine px-6 text-center">
      <div>
        <p className="font-display text-[clamp(5rem,20vw,12rem)] leading-none text-croute">404</p>
        <h1 className="font-display text-3xl tracking-tight">Ce site n&apos;existe pas (ou plus).</h1>
        <a href="/studio" className="mt-8 inline-flex h-12 items-center rounded-full bg-cafe px-7 font-semibold text-creme transition hover:bg-croute">
          Retour au Studio
        </a>
      </div>
    </section>
  );
}
