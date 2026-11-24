import { Words } from "./Words";

export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="grain relative isolate -mt-[88px] overflow-hidden bg-navy-900 pt-[88px] text-white sm:-mt-[96px] sm:pt-[96px]">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 animate-blob bg-brand/30 blur-3xl motion-reduce:animate-none" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-10 -z-10 h-72 w-72 animate-blob bg-brand-200/10 blur-3xl [animation-delay:-7s] motion-reduce:animate-none" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="container py-16 sm:py-24">
        {eyebrow && <p className="eyebrow animate-pop-in text-brand-200">{eyebrow}</p>}
        <h1 className="mt-3 max-w-4xl font-display text-[2.3rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
          <Words text={title} delay={80} step={60} />
        </h1>
        {subtitle && <p className="mt-5 max-w-2xl animate-fade-up text-lg leading-relaxed text-navy-100 [animation-delay:450ms]">{subtitle}</p>}
      </div>
      <div aria-hidden className="h-6 rounded-t-[2rem] bg-white" />
    </section>
  );
}
