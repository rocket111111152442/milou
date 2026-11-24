/**
 * Agency identity. Every value comes from public sources, listed next to it:
 *  - [SITE]  current site elvynarnaudrealty.com (AlterEstate, read 24/11/2026)
 *  - [KB]    "Base de conocimiento — Asistente IA de Elvyn Arnaud Realty" (23/11/2026)
 *  - [CARD]  business card / brand assets in the agency Google Drive
 * Do not add facts here without a source.
 */
export const site = {
  name: "Elvyn Arnaud Realty Group", // [SITE] company.name
  shortName: "Elvyn Arnaud Realty",
  legalName: "DRSPACE FINDERS EIRL", // [SITE] company.legal_name, [KB]
  tagline: { es: "Tu solución inmobiliaria", en: "Your real estate solution" }, // [CARD] logo
  motto: { es: "El Realtor que Resuelve", en: "The Realtor who gets it done" }, // [KB]
  quote: {
    // [SITE] meta description
    es: "Confianza que abre puertas, experiencia que construye futuro.",
    en: "Trust that opens doors, experience that builds the future.",
  },
  domain: "elvynarnaudrealty.com", // [SITE] company.domain
  phone: { display: "+1 (809) 710-5384", e164: "+18097105384" }, // [SITE] [KB]
  whatsapp: "18097105384", // [SITE] site_config.whatsapp_button, [KB]
  email: "elvyn@drspacefinders.com", // [SITE] [KB]
  /**
   * Office. Two addresses are published:
   *  - [KB] (23/11/2026, "Dirección para visitas"): Carretera Cabrera – Río San Juan, Local 15, Segundo Nivel, Plaza DF060
   *  - [SITE] contact page (last edited 2023-10-13) and business card: C. Lorenzo Álvarez No. 67, Cabrera 33200
   * Confirmed by Elvyn on 24/11/2026: Plaza DF-060.
   */
  address: {
    street: { es: "Plaza DF-060, Local 15, Segundo Nivel, Carretera Cabrera – Río San Juan", en: "Plaza DF-060, Unit 15, Second Floor, Carretera Cabrera – Río San Juan" },
    locality: "Cabrera",
    region: "María Trinidad Sánchez",
    country: "República Dominicana",
    countryCode: "DO",
    previous: "C. Lorenzo Álvarez No. 67, Cabrera 33200",
  },
  /** Office hours, confirmed by Elvyn on 24/11/2026 (Dominican Republic time, UTC-4). */
  hours: {
    es: "Lunes a viernes de 9:00 a. m. a 6:00 p. m. · Sábados de 9:00 a. m. a 1:00 p. m. · Domingos solo con cita",
    en: "Monday to Friday 9 am – 6 pm · Saturday 9 am – 1 pm · Sunday by appointment only",
  } as null | { es: string; en: string },
  /** Same hours, machine-readable (0 = Sunday). Used for schema.org and the assistant's out-of-hours notice. */
  openingHours: [
    { days: [1, 2, 3, 4, 5], opens: "09:00", closes: "18:00" },
    { days: [6], opens: "09:00", closes: "13:00" },
  ],
  social: {
    instagram: { handle: "@elvynarnaud", url: "https://www.instagram.com/elvynarnaud/" },
    facebook: { handle: "elvyn.drspacefinders", url: "https://www.facebook.com/elvyn.drspacefinders" },
    youtube: { handle: "@elvynarnaudrealty", url: "https://www.youtube.com/@elvynarnaudrealty" },
    linkedin: { handle: "elvynarnaud-realtor", url: "https://www.linkedin.com/in/elvynarnaud-realtor/" },
  },
  // [KB] "corredor Cabrera–Río San Juan (costa norte)"; [SITE] meta_tags also mention Nagua.
  areas: ["Cabrera", "Río San Juan", "Nagua", "María Trinidad Sánchez"],
  languages: ["es", "en"] as const,
  brandColor: "#EB6500",
  navy: "#102632",
} as const;

export type SiteConfig = typeof site;

/** Public team as listed on /agentes of the current site. */
export const team = [
  {
    slug: "elvyn-arnaud",
    name: "Elvyn Daniel Arnaud Paredes",
    shortName: "Elvyn Arnaud",
    role: { es: "Fundador y corredor inmobiliario", en: "Founder and real estate broker" },
    photo: "/img/elvyn-arnaud.jpg",
    phone: "+18097105384",
    email: "elvyn@drspacefinders.com",
    instagram: "elvynarnaud",
  },
  {
    slug: "edwin-guzman",
    name: "Edwin Guzmán García",
    shortName: "Edwin Guzmán",
    role: { es: "Agente inmobiliario", en: "Real estate agent" },
    photo: "/img/edwin-guzman.jpg",
    phone: "+18098412023",
    email: "delmarinmobiliariard@gmail.com",
    instagram: "edwin_guzman_garcia",
  },
] as const;

export function whatsappLink(message?: string, number: string = site.whatsapp) {
  const base = `https://wa.me/${number.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
