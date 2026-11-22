import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { getPosts } from "@/lib/store";
import { formatDate } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog & actualités – sorties en famille à La Seyne-sur-Mer",
  description:
    "Les news de Chouet'House : nouveaux ateliers, événements, idées de sorties avec bébé et enfants à La Seyne-sur-Mer et Toulon, conseils pour les anniversaires.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await getPosts();
  const [first, ...rest] = posts;

  return (
    <>
      <PageHero
        eyebrow="Le blog"
        title="Les news de la maison"
        intro={<p>Nouveaux ateliers, événements, coulisses et idées de sorties en famille dans le Var : toute l&apos;actu de Chouet&apos;House.</p>}
        color="sage"
      />
      <section className="container-x pb-10">
        {!first ? (
          <p className="rounded-3xl bg-shell p-10 text-center text-lg">Les premiers articles arrivent très vite !</p>
        ) : (
          <>
            <Reveal>
              <Link href={`/blog/${first.slug}`} className="group card grid overflow-hidden md:grid-cols-2">
                <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[420px]">
                  <Image src={first.cover} alt={first.title} fill priority sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                </div>
                <div className="flex flex-col justify-center p-8 sm:p-12">
                  <span className="eyebrow self-start">À la une</span>
                  <p className="mt-5 text-sm font-bold text-sage-deep">{formatDate(first.date.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}</p>
                  <h2 className="mt-2 text-3xl font-semibold transition group-hover:text-tomato sm:text-4xl">{first.title}</h2>
                  <p className="mt-4 text-lg text-ink-soft">{first.excerpt}</p>
                  <span className="mt-6 font-display text-lg font-semibold text-tomato">Lire l&apos;article →</span>
                </div>
              </Link>
            </Reveal>
            <Stagger className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <StaggerItem key={p.id}>
                  <Link href={`/blog/${p.slug}`} className="group block h-full">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-white shadow-lg">
                      <Image src={p.cover} alt={p.title} fill sizes="(min-width:1024px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {p.tags.slice(0, 2).map((t) => (
                        <span key={t} className="rounded-full bg-mint px-3 py-0.5 text-xs font-bold text-sage-deep">{t}</span>
                      ))}
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold transition group-hover:text-tomato">{p.title}</h2>
                    <p className="mt-2 line-clamp-3 text-ink-soft">{p.excerpt}</p>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </>
        )}
      </section>
    </>
  );
}
