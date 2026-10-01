import Image from "next/image";
import { brand } from "@/data/site";
import Reveal from "./Reveal";

const pillars = [
  { title: "Bold flavor", text: "Street-food classics, built to be shared and eaten with your hands.", color: "bg-chili text-white", rot: "-rotate-2" },
  { title: "Good music", text: "The playlist is part of the menu. Come for tacos, stay for the vibe.", color: "bg-mango text-char", rot: "rotate-1" },
  { title: "Two places", text: "Sunset by the beach or late nights in the city — pick your mood.", color: "bg-ocean text-white", rot: "-rotate-1" },
];

export default function Story() {
  return (
    <section id="story" className="grain relative overflow-hidden bg-char py-20 text-cream sm:py-28" aria-labelledby="story-title">
      <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-8">
        <Reveal>
          <p className="eyebrow text-mango">The Taco J story</p>
          <h2 id="story-title" className="display mt-4 text-6xl sm:text-7xl lg:text-8xl">
            Street food,
            <span className="block text-chili-light">good vibes,</span>
            <span className="block text-mango">no dress code.</span>
          </h2>
          {brand.storyImage && (
            <div className="relative mt-10 aspect-[4/5] w-full max-w-sm -rotate-2 overflow-hidden rounded-[28px] border-[3px] border-cream shadow-[10px_10px_0_0_#D42A1E] transition duration-500 hover:rotate-0">
              <Image src={brand.storyImage} alt="Two Taco J burritos held up against a pop-art wall" fill sizes="(min-width:1024px) 384px, 90vw" className="object-cover" />
              <span className="absolute bottom-4 left-4 rotate-[-4deg] rounded-full bg-mango px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-char shadow-sticker">Made to share</span>
            </div>
          )}
        </Reveal>
        <Reveal delay={120} className="flex flex-col justify-end">
          <p className="text-xl leading-relaxed text-cream/85 sm:text-2xl">
            Taco J is built on a simple idea: bold, Mexican-inspired street food with a local twist, served somewhere you actually want to hang out.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-cream/70">
            Today that means two very different places. Liwa is barefoot, salty-haired and golden-hour warm. SBMA is neon, loud and open late. Same tacos, same energy — just a different soundtrack.
          </p>
          <p className="mt-6 font-hand text-3xl text-mango">See you at the table. 🌮</p>
        </Reveal>
      </div>

      <ul className="relative z-10 mx-auto mt-16 grid max-w-7xl gap-5 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
        {pillars.map((p, i) => (
          <Reveal as="li" key={p.title} delay={i * 100}>
            <div className={`${p.color} ${p.rot} ticket rounded-2xl px-6 py-6 shadow-[6px_6px_0_0_rgba(0,0,0,.45)] transition duration-300 hover:rotate-0 hover:scale-[1.02]`}>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-80">No. 0{i + 1}</p>
              <h3 className="display mt-2 text-4xl">{p.title}</h3>
              <div className="dashed-rule my-4" />
              <p className="text-[15px] font-medium leading-relaxed opacity-90">{p.text}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
