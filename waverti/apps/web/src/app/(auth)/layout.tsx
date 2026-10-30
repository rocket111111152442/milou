import Link from "next/link";
import { Logo } from "@waverti/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh grid-rows-[auto_1fr_auto] bg-surface">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-waverti-gradient" />
      <header className="mx-auto flex w-full max-w-[1200px] items-center px-4 py-6 sm:px-6">
        <Link href="/" aria-label="Waverti, accueil">
          <Logo />
        </Link>
      </header>
      <main id="contenu" className="flex items-start justify-center px-4 py-8 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-muted-fg">
        WAVERTI — Développé par{" "}
        <a href="https://www.lullin-web.com" className="underline-offset-4 hover:underline">
          LULLIN WEB
        </a>
      </footer>
    </div>
  );
}
