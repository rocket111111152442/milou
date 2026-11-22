import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { getPost, getPosts } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { Reveal, SplitTitle } from "@/components/motion";
import { Blob, Wave } from "@/components/decor";
import { CTABand } from "@/components/ui";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt, images: [post.cover], publishedTime: post.date },
  };
}

/** Échappe le HTML brut éventuel du markdown (contenu saisi dans l'admin) */
function renderMarkdown(md: string) {
  const safe = md.replace(/</g, "&lt;");
  return marked.parse(safe, { async: false }) as string;
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const others = (await getPosts()).filter((p) => p.id !== post.id).slice(0, 2);

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.cover.startsWith("http") ? post.cover : `${SITE.url}${post.cover}`,
    datePublished: post.date,
    dateModified: post.updatedAt ?? post.date,
    author: { "@type": "Organization", name: SITE.fullName },
    publisher: { "@type": "Organization", name: SITE.fullName, logo: { "@type": "ImageObject", url: `${SITE.url}/images/logo.webp` } },
    mainEntityOfPage: `${SITE.url}/blog/${post.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="relative bg-mint pt-32 sm:pt-40">
        <Blob className="-top-20 -right-20 h-72 w-72 opacity-40" color="var(--color-sage)" />
        <div className="container-x relative max-w-4xl pb-12 text-center">
          <Link href="/blog" className="font-bold text-sage-deep hover:text-tomato">← Tous les articles</Link>
          <p className="mt-6 text-sm font-bold text-sage-deep">{formatDate(post.date.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">
            <SplitTitle text={post.title} />
          </h1>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-sage-deep">{t}</span>
            ))}
          </div>
        </div>
        <Wave color="var(--color-cream)" />
      </section>
      <article className="container-x max-w-4xl">
        <Reveal>
          <div className="relative -mt-4 aspect-[16/9] overflow-hidden rounded-[2.5rem] shadow-2xl ring-8 ring-white">
            <Image src={post.cover} alt={post.title} fill priority sizes="(min-width:1024px) 900px, 100vw" className="object-cover" />
          </div>
        </Reveal>
        <p className="mt-12 text-xl font-semibold text-ink">{post.excerpt}</p>
        <div className="prose-ch mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />
      </article>

      {others.length > 0 && (
        <section className="container-x mt-24 max-w-5xl">
          <h2 className="text-3xl font-semibold">À lire aussi</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {others.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="group card flex items-center gap-4 p-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
                  <Image src={p.cover} alt="" fill sizes="96px" className="object-cover" />
                </div>
                <p className="font-display text-xl font-semibold transition group-hover:text-tomato">{p.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <CTABand title="Envie de passer nous voir ?" text={`${SITE.hours} · ${SITE.street}, ${SITE.city}`}>
        <Link href="/ateliers-enfants" className="btn-yellow">Les ateliers</Link>
        <Link href="/restaurant-brunch#reserver" className="btn bg-white text-ink">Réserver une table</Link>
      </CTABand>
    </>
  );
}
