import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoPage } from "@/components/marketing/seo-page";
import { seoPages } from "@/lib/seo-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(seoPages).map((seo) => ({ seo }));
}

export async function generateMetadata({ params }: { params: Promise<{ seo: string }> }): Promise<Metadata> {
  const { seo } = await params;
  const page = seoPages[seo];
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: { title: page.title, description: page.description, url: `/${page.slug}` },
  };
}

export default async function SeoLandingPage({ params }: { params: Promise<{ seo: string }> }) {
  const { seo } = await params;
  const page = seoPages[seo];
  if (!page) notFound();
  return <SeoPage content={page} />;
}
