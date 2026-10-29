import Link from "next/link";
import { ArrowRight, Bell, Laptop, Cloud, TrendingDown } from "lucide-react";
import { Button } from "@watchly/ui";
import { MonitorList } from "@watchly/ui/app";
import { DEMO_NOW, demoMonitors } from "@/lib/demo-data";
import { BrowserFrame } from "./browser-frame";

/**
 * Animations d'entrée en CSS (`animate-fade-up`) : le contenu reste visible sans JavaScript
 * et les animations sont neutralisées par prefers-reduced-motion.
 */
const delay = (s: number) => ({ animationDelay: `${s}s` });

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="hairline-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-280px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-watchly-gradient opacity-[0.10] blur-[110px]"
      />
      <div className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p
            style={delay(0)}
            className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink-soft shadow-soft"
          >
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue/50 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-blue" />
            </span>
            Votre assistant de surveillance d'Internet
          </p>
          <h1
            id="hero-title"
            style={delay(0.08)}
            className="animate-fade-up mt-7 text-balance font-display text-[44px] font-extrabold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[64px] lg:text-[76px]"
          >
            Ne cherchez plus. <span className="gradient-underline">Watchly</span> le fait pour vous.
          </h1>
          <p style={delay(0.16)} className="animate-fade-up mt-6 max-w-2xl text-lg leading-relaxed text-muted-fg sm:text-xl">
            Surveillez les prix, les annonces, les nouveautés et vos sites internet. Recevez une alerte quand quelque chose
            d'important se produit.
          </p>
          <div
            style={delay(0.24)}
            className="animate-fade-up mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
          >
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/inscription">
                Commencer gratuitement <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
              <Link href="#comment-ca-marche">Découvrir Watchly</Link>
            </Button>
          </div>
          <p style={delay(0.3)} className="animate-fade-up mt-4 text-[13px] text-muted-fg">
            Formule Découverte gratuite, sans carte bancaire.
          </p>
        </div>

        <div style={delay(0.35)} className="animate-fade-up relative mx-auto mt-16 max-w-5xl">
          <BrowserFrame label="app.watchly — Mes surveillances" caption="Données fictives de démonstration">
            <div className="flex flex-col gap-4 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="font-display text-lg font-bold">Mes surveillances</p>
                  <p className="text-sm text-muted-fg">4 surveillances · 1 alerte aujourd'hui</p>
                </div>
                <span className="relative hidden overflow-hidden rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft sm:inline-flex">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1/2 animate-scan bg-gradient-to-r from-transparent via-cyan/25 to-transparent motion-reduce:hidden"
                  />
                  Contrôle en cours…
                </span>
              </div>
              <MonitorList monitors={demoMonitors} hrefFor={() => "#demo"} now={DEMO_NOW} />
            </div>
          </BrowserFrame>

          <FloatingCard
            className="-left-3 top-24 hidden md:flex lg:-left-12"
            delay={1.1}
            icon={<TrendingDown className="size-4 text-violet" />}
            title="Prix sous 800 €"
            text="789,00 € · il y a 12 min"
          />
          <FloatingCard
            className="-right-3 top-52 hidden md:flex lg:-right-10"
            delay={1.4}
            icon={<Laptop className="size-4 text-blue" />}
            title="Contrôle sur votre PC"
            text="Relais cloud prêt si besoin"
            secondaryIcon={<Cloud className="size-3.5 text-muted" />}
          />
          <FloatingCard
            className="-bottom-6 left-1/2 hidden -translate-x-1/2 sm:flex"
            delay={1.7}
            icon={<Bell className="size-4 text-pink" />}
            title="Alerte envoyée"
            text="Dans l'application et par e-mail"
          />
        </div>
      </div>
    </section>
  );
}

function FloatingCard({
  className,
  delay: d,
  icon,
  title,
  text,
  secondaryIcon,
}: {
  className: string;
  delay: number;
  icon: React.ReactNode;
  title: string;
  text: string;
  secondaryIcon?: React.ReactNode;
}) {
  return (
    <div aria-hidden="true" className={`absolute z-10 ${className}`}>
      <div
        style={{ animationDelay: `${d}s, ${d + 0.6}s` }}
        className="animate-float flex items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-lift backdrop-blur"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-surface">{icon}</span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold">{title}</span>
          <span className="flex items-center gap-1 text-xs text-muted-fg">
            {secondaryIcon}
            {text}
          </span>
        </span>
      </div>
    </div>
  );
}
