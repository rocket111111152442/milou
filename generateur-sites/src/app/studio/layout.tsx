import type { Metadata } from "next";
import Link from "next/link";
import { isStudio, studioConfigured } from "@/lib/auth";
import { StudioLogin } from "./StudioLogin";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = { title: "Studio · générateur de sites", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  if (!studioConfigured()) {
    return (
      <section className="grid min-h-screen place-items-center bg-farine px-6">
        <div className="max-w-md rounded-[2rem] bg-creme p-8 ring-1 ring-mie">
          <h1 className="font-display text-3xl">Studio</h1>
          <p className="mt-3 text-cafe/70">
            Ajoutez la variable <code>ADMIN_PASSWORD</code> dans Vercel (Settings → Environment Variables) puis redéployez.
          </p>
        </div>
      </section>
    );
  }
  if (!(await isStudio())) return <StudioLogin />;
  return (
    <div className="min-h-screen bg-farine">
      <header className="sticky top-0 z-40 border-b border-mie bg-farine/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/studio" className="leading-none">
            <span className="block font-script text-lg text-caramel">Générateur de sites</span>
            <span className="block font-display text-xl">Studio</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/studio/new" className="inline-flex h-10 items-center rounded-full bg-croute px-5 text-sm font-semibold text-creme transition hover:bg-cafe">
              + Nouveau site
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
