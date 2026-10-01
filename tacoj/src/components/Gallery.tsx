import Image from "next/image";
import { brand, instagramPosts } from "@/data/site";
import { InstagramIcon } from "./Icons";
import Reveal from "./Reveal";
import FoodArt from "./FoodArt";
import { NightScene, SunsetScene } from "./Scenes";

// Placeholder artwork rotation used until real @tacojointph photos are set in src/data/site.ts
const placeholders = [
  (i: number) => <FoodArt art="taco" className="h-full w-full" key={i} />,
  (i: number) => <SunsetScene id={`g${i}`} className="h-full w-full" key={i} />,
  (i: number) => <NightScene id={`g${i}`} className="h-full w-full" key={i} />,
  (i: number) => <FoodArt art="burrito" className="h-full w-full" key={i} />,
  (i: number) => <FoodArt art="nachos" className="h-full w-full" key={i} />,
  (i: number) => <FoodArt art="churro" className="h-full w-full" key={i} />,
];

export default function Gallery() {
  return (
    <section id="instagram" className="grain relative overflow-hidden bg-chili py-20 text-white sm:py-28" aria-labelledby="ig-title">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-mango">On the gram</p>
            <h2 id="ig-title" className="display mt-3 text-6xl sm:text-7xl lg:text-8xl">
              {brand.instagramHandle}
            </h2>
          </div>
          <p className="max-w-sm text-lg font-medium text-white/90">
            Fresh photos, new menu items and the latest hours land on our Instagram first.
          </p>
        </Reveal>

        <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6 lg:grid-rows-2">
          {instagramPosts.map((post, i) => {
            const big = i === 0 || i === 3;
            return (
              <Reveal
                as="li"
                key={i}
                delay={(i % 3) * 80}
                className={big ? "col-span-2 row-span-2 lg:col-span-2" : "lg:col-span-1"}
              >
                <a
                  href={post.href || brand.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-2xl border-[3px] border-char bg-char shadow-[5px_5px_0_0_#1B1614] transition duration-300 hover:-translate-y-1 hover:rotate-[-0.6deg]"
                  aria-label={`${post.alt} — view on Instagram (opens in a new tab)`}
                >
                  {post.image ? (
                    <Image src={post.image} alt={post.alt} fill sizes="(min-width:1024px) 33vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full transition duration-500 group-hover:scale-105">{placeholders[i % placeholders.length](i)}</div>
                  )}
                  <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-char/80 via-transparent to-transparent p-3 opacity-100 transition sm:p-4 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100">
                    <span className="font-hand text-xl text-cream sm:text-2xl">{post.caption}</span>
                    <InstagramIcon className="h-5 w-5 text-cream" />
                  </div>
                </a>
              </Reveal>
            );
          })}
        </ul>

        <Reveal className="mt-12 flex flex-col items-start gap-4 rounded-3xl border-[3px] border-char bg-mango p-6 text-char shadow-sticker-lg sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <p className="display text-3xl sm:text-4xl">Follow {brand.instagramHandle} for menu drops, hours and good vibes.</p>
          <a href={brand.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn shrink-0 bg-char text-cream shadow-[4px_4px_0_0_#D42A1E] hover:-translate-y-0.5">
            <InstagramIcon /> Follow on Instagram
          </a>
        </Reveal>
      </div>
    </section>
  );
}
