import { brand, locations } from "@/data/site";
import { HoursTable, StatusPill } from "./Hours";
import { DirectionsIcon, InstagramIcon, PhoneIcon, PinIcon } from "./Icons";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer id="contact" className="grain grain-light relative bg-char pt-20 text-cream sm:pt-28" aria-labelledby="contact-title">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-mango">Contact &amp; hours</p>
            <h2 id="contact-title" className="display mt-3 text-6xl sm:text-7xl lg:text-8xl">
              Come hungry<span className="text-chili-light">.</span>
            </h2>
          </div>
          <a href={brand.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-mango self-start md:self-auto">
            <InstagramIcon /> {brand.instagramHandle}
          </a>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {locations.map((l) => (
            <section key={l.id} aria-labelledby={`footer-${l.id}`} className="rounded-[28px] border border-cream/15 bg-cream/[0.04] p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id={`footer-${l.id}`} className="display flex flex-wrap items-center gap-x-3 gap-y-2 text-4xl">
                  {l.name}
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 font-sans text-xs font-extrabold uppercase tracking-wider ${l.theme === "sun" ? "bg-mango text-char" : "bg-chili text-white"}`}>
                    {l.mood}
                  </span>
                </h3>
                <StatusPill location={l} />
              </div>
              <div className="mt-6 flex items-start gap-3 text-cream/85">
                <PinIcon className="mt-1 h-5 w-5 shrink-0 text-mango" />
                <address className="not-italic leading-relaxed">{l.address.join(", ")}</address>
              </div>
              <div className="mt-5 text-cream/90">
                <HoursTable location={l} tone="dark" />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {l.phones.map((p) => (
                  <a key={p.tel} href={`tel:${p.tel}`} className="btn border-2 border-cream/25 !min-h-[44px] text-cream hover:border-mango hover:text-mango" aria-label={`Call ${l.name} at ${p.display}`}>
                    <PhoneIcon className="h-4 w-4" /> <span className="tabular-nums">{p.display}</span>
                  </a>
                ))}
                <a href={l.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-mango !min-h-[44px]" aria-label={`Directions to ${l.name} (opens Google Maps)`}>
                  <DirectionsIcon className="h-4 w-4" /> Directions
                </a>
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 flex items-start gap-3 rounded-2xl bg-mango/10 px-5 py-4 text-sm font-semibold text-mango ring-1 ring-mango/30">
          <span aria-hidden>⚠︎</span> {brand.updatesNote}
        </p>

        <div className="mt-16 flex flex-col gap-6 border-t border-cream/10 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Logo size="lg" />
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-cream/70">
              <li><a className="hover:text-mango" href="#menu">Menu</a></li>
              <li><a className="hover:text-mango" href="#locations">Locations</a></li>
              <li><a className="hover:text-mango" href="#liwa">Liwa</a></li>
              <li><a className="hover:text-mango" href="#sbma">SBMA</a></li>
              <li><a className="hover:text-mango" href={brand.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a></li>
            </ul>
          </nav>
          <p className="text-xs text-cream/50">© {new Date().getFullYear()} {brand.fullName}. Mexican-inspired street food.</p>
        </div>
      </div>
    </footer>
  );
}
