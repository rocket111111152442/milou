import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Story } from "@/components/home/Story";
import { SavoirFaire } from "@/components/home/SavoirFaire";
import { Rayons } from "@/components/home/Rayons";
import { Formules, GateauxCta } from "@/components/home/Formules";
import { Gallery } from "@/components/home/Gallery";
import { Infos } from "@/components/home/Infos";

export default function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Story />
      <SavoirFaire />
      <Rayons />
      <Formules />
      <GateauxCta />
      <Gallery />
      <Infos />
    </>
  );
}
