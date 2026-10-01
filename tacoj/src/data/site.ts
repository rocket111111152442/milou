/**
 * ─────────────────────────────────────────────────────────────
 *  TACO J — SITE CONTENT
 *  This is the ONLY file you need to edit to update branches,
 *  opening hours, phone numbers, links, menu items and photos.
 * ─────────────────────────────────────────────────────────────
 *
 *  Photos: drop files into /public/images and reference them as
 *  "/images/your-file.jpg". Leave `image` empty to show the
 *  branded placeholder artwork instead.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday … 6 = Saturday

export type HoursRule = {
  /** Days this rule covers (0 = Sunday). */
  days: Weekday[];
  /** Human label shown on the site. */
  label: string;
  /** 24h "HH:MM". */
  open: string;
  /** 24h "HH:MM". A close time earlier than (or equal to) open means "after midnight". */
  close: string;
};

export type Location = {
  id: "liwa" | "sbma";
  name: string;
  shortName: string;
  mood: string;
  tagline: string;
  description: string;
  address: string[];
  phones: { display: string; tel: string }[];
  hours: HoursRule[];
  /** PLACEHOLDER — replace with the branch's official Google Maps share link. */
  mapsUrl: string;
  /** PLACEHOLDER — online ordering link (GrabFood, Foodpanda, own system…). Leave "" to hide. */
  orderUrl: string;
  /** PLACEHOLDER — reservation link. Leave "" to hide. Do not add a fake system. */
  reserveUrl: string;
  /** Optional photo for the branch card / experience section. */
  image: string;
  highlights: string[];
  theme: "sun" | "night";
};

export type MenuItem = {
  name: string;
  description: string;
  /** Leave "" to display "Ask in store". Never invent prices. */
  price: string;
  /** Which branch serves it. */
  availableAt: "both" | "liwa" | "sbma";
  tag?: string;
  image: string;
  /** Optional CSS object-position for the photo crop, e.g. "center 75%". */
  imagePosition?: string;
  art: "taco" | "burrito" | "quesadilla" | "nachos" | "corn" | "sticks" | "fries" | "churro" | "drink";
};

export type MenuCategory = {
  id: string;
  label: string;
  intro: string;
  items: MenuItem[];
};

/* ───────────── BRAND ───────────── */

export const brand = {
  name: "Taco J",
  fullName: "Taco Joint PH",
  /** PLACEHOLDER — set to "/images/logo.svg" (or .png) once the official logo is added. */
  logo: "",
  instagramHandle: "@tacojointph",
  instagramUrl: "https://www.instagram.com/tacojointph/",
  /** PLACEHOLDER — link to the full menu (Instagram highlight, PDF, etc.). */
  fullMenuUrl: "https://www.instagram.com/tacojointph/",
  /** Optional hero photo. Leave "" for the branded poster artwork. */
  heroImage: "/images/food-spread.jpg",
  /** Photo shown in the brand story section. Leave "" to hide. */
  storyImage: "/images/burritos.jpg",
  updatesNote: "Hours and menu availability may change — check Instagram for the latest updates.",
  timeZone: "Asia/Manila",
};

/* ───────────── LOCATIONS ───────────── */

export const locations: Location[] = [
  {
    id: "liwa",
    name: "Taco J Liwa",
    shortName: "Liwa",
    mood: "Beachfront",
    tagline: "Tacos by the sea.",
    description:
      "Sand between your toes, a surf-town crowd and the sun dropping into the sea. Our Liwa spot is where long beach days end with a table full of tacos and good music.",
    address: ["Board Culture Liwa, Sitio Liwa", "Santo Niño, San Felipe", "Zambales 2204, Philippines"],
    phones: [
      { display: "+63 998 193 8418", tel: "+639981938418" },
      { display: "+63 927 401 2709", tel: "+639274012709" },
    ],
    hours: [
      { days: [1, 2, 3, 4], label: "Monday–Thursday", open: "11:00", close: "22:00" },
      { days: [5, 6, 0], label: "Friday–Sunday", open: "10:00", close: "00:00" },
    ],
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Board+Culture+Liwa+San+Felipe+Zambales",
    orderUrl: "",
    reserveUrl: "",
    image: "/images/golden-hour.jpg",
    highlights: ["Beachfront", "Sunset sessions", "Surf-town crowd", "Open 10 AM Fri–Sun"],
    theme: "sun",
  },
  {
    id: "sbma",
    name: "Taco J SBMA",
    shortName: "SBMA",
    mood: "Late Night",
    tagline: "Food after hours.",
    description:
      "City lights, cold cocktails and the whole barkada around one table. Our Subic Bay spot runs late — made for after-work rounds, birthdays and those 1 AM birria cravings.",
    address: ["560 Sampson Road, Central Business District", "Subic Bay Freeport Zone", "Zambales, Philippines"],
    phones: [{ display: "+63 917 143 5396", tel: "+639171435396" }],
    hours: [
      { days: [1, 2, 3, 4], label: "Monday–Thursday", open: "13:00", close: "23:00" },
      { days: [5, 6, 0], label: "Friday–Sunday", open: "13:00", close: "02:00" },
    ],
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=560+Sampson+Road+Subic+Bay+Freeport+Zone",
    orderUrl: "",
    reserveUrl: "",
    image: "",
    highlights: ["Open till 2 AM Fri–Sun", "Cocktails", "Groups welcome", "City vibes"],
    theme: "night",
  },
];

/* ───────────── MENU ─────────────
 * Prices are intentionally empty → the site shows "Ask in store".
 * Add a price as a string, e.g. "₱180", when you want it displayed.
 */

export const menu: MenuCategory[] = [
  {
    id: "tacos",
    label: "Tacos",
    intro: "Soft tortillas, loaded up. Order a few and share.",
    items: [
      { name: "Carne Asada", description: "Grilled steak taco.", price: "", availableAt: "both", tag: "Fan favorite", image: "", art: "taco" },
      { name: "Birria", description: "Slow-braised beef taco — ask for consommé to dip.", price: "", availableAt: "both", tag: "Dip it", image: "", art: "taco" },
      { name: "Camarones", description: "Shrimp taco.", price: "", availableAt: "both", image: "", art: "taco" },
      { name: "Seasonal Taco", description: "Rotating taco choices — check Instagram for what's on.", price: "", availableAt: "both", tag: "Rotating", image: "", art: "taco" },
    ],
  },
  {
    id: "burritos",
    label: "Burritos & Quesadillas",
    intro: "Big, wrapped and built for hungry nights.",
    items: [
      { name: "Birria Burrito", description: "Birria wrapped up burrito-style.", price: "", availableAt: "both", tag: "Must-try", image: "", art: "burrito" },
      { name: "Burritos", description: "Ask the team for today's fillings.", price: "", availableAt: "both", image: "/images/burritos.jpg", imagePosition: "center 40%", art: "burrito" },
      { name: "Quesadillas", description: "Toasted tortilla, melted cheese.", price: "", availableAt: "both", image: "/images/food-spread.jpg", imagePosition: "center 80%", art: "quesadilla" },
    ],
  },
  {
    id: "sides",
    label: "Sides",
    intro: "For the table. Or just for you.",
    items: [
      { name: "Nachos", description: "Made for sharing.", price: "", availableAt: "both", image: "/images/nachos.jpg", imagePosition: "center 60%", art: "nachos" },
      { name: "Elotes", description: "Mexican-style street corn.", price: "", availableAt: "both", image: "/images/elotes.jpg", art: "corn" },
      { name: "Jalapeño Cheese Sticks", description: "Crispy, cheesy, a little heat.", price: "", availableAt: "both", image: "", art: "sticks" },
      { name: "Loaded / Carne Fries", description: "Fries, loaded up.", price: "", availableAt: "both", tag: "Late-night pick", image: "", art: "fries" },
      { name: "Churros", description: "The sweet finish.", price: "", availableAt: "both", tag: "Sweet", image: "", art: "churro" },
    ],
  },
  {
    id: "drinks",
    label: "Drinks",
    intro: "Cold ones for warm nights. Cocktails are served at SBMA.",
    items: [
      { name: "Cocktails", description: "Ask the bar for tonight's cocktail list.", price: "", availableAt: "sbma", tag: "SBMA", image: "", art: "drink" },
      { name: "Drinks", description: "Soft drinks and refreshers — ask in store.", price: "", availableAt: "both", image: "", art: "drink" },
    ],
  },
];

/* ───────────── INSTAGRAM GALLERY ─────────────
 * Replace each `image` with a photo from @tacojointph (saved to /public/images),
 * and optionally set `href` to the exact post URL.
 */

export const instagramPosts: { image: string; alt: string; caption: string; href: string }[] = [
  { image: "/images/food-spread.jpg", alt: "Quesadillas, a burrito and chips on trays at Taco J", caption: "Table goals", href: "" },
  { image: "/images/golden-hour.jpg", alt: "Squeezing lime over the food in golden-hour light", caption: "Golden hour", href: "" },
  { image: "", alt: "Cocktails at Taco J SBMA", caption: "SBMA after dark", href: "" },
  { image: "/images/elotes.jpg", alt: "Elotes — street corn with chips", caption: "Elotes", href: "" },
  { image: "/images/nachos.jpg", alt: "Two hands grabbing loaded nachos from a tray", caption: "Share the nachos", href: "" },
  { image: "/images/burritos.jpg", alt: "Two burrito halves held up against a pop-art wall", caption: "Burrito o'clock", href: "" },
];
