import BranchExperience from "@/components/BranchExperience";
import BranchSelector from "@/components/BranchSelector";
import Footer from "@/components/Footer";
import Gallery from "@/components/Gallery";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import MenuSection from "@/components/MenuSection";
import Story from "@/components/Story";
import { locations } from "@/data/site";

export default function Home() {
  const liwa = locations.find((l) => l.id === "liwa")!;
  const sbma = locations.find((l) => l.id === "sbma")!;
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Marquee />
        <BranchSelector />
        <Story />
        <MenuSection />
        <BranchExperience location={liwa} />
        <BranchExperience location={sbma} />
        <Gallery />
      </main>
      <Footer />
    </>
  );
}
