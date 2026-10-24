// Gravures botaniques anciennes (Public Domain Mark — Wellcome Collection), converties en encre.
export const PLATES = {
  violette: { w: 820, h: 1041, title: "Violette — eau-forte de N. Robert, vers 1660" },
  pensee: { w: 820, h: 1092, title: "Pensée sauvage — gravure, XIXᵉ siècle" },
  julienne: { w: 820, h: 1198, title: "Julienne des dames — gravure coloriée, XVIIIᵉ siècle" },
  martagon: { w: 820, h: 1079, title: "Lys martagon, campanule et pensée — eau-forte de N. Robert" },
  fougere: { w: 820, h: 1139, title: "Fougère mâle — impression nature d'A. Auer, vers 1853" },
  iris: { w: 820, h: 1071, title: "Tulipe panachée et iris — eau-forte de N. Robert" },
  bleuet: { w: 820, h: 1081, title: "Bleuet et iris — eau-forte de N. Robert" },
  anemone: { w: 820, h: 1071, title: "Anémones — eau-forte de N. Robert, vers 1660" },
  "anemone-lys": { w: 820, h: 1064, title: "Anémone et lys — eau-forte de N. Robert" },
  "bouquet-ancien": { w: 820, h: 1022, title: "Tanaisie et tulipe — eau-forte de N. Robert" },
  tulipe: { w: 820, h: 1077, title: "Doronic et tulipe — eau-forte de N. Robert" },
  pivoine: { w: 820, h: 864, title: "Pivoines double et simple — gravure, XVIIIᵉ siècle" },
  renoncule: { w: 820, h: 1097, title: "Renoncule — eau-forte d'après C. Aubriet, 1718" },
  rose: { w: 820, h: 1251, title: "Églantier — gravure d'après J. Sowerby, vers 1830" },
  eglantier: { w: 820, h: 1239, title: "Rosier des chiens — gravure d'après J. Sowerby, 1829" },
  dahlia: { w: 820, h: 1340, title: "Dahlia des jardins — gravure, vers 1842" },
  lys: { w: 820, h: 1064, title: "Lys blanc et iris — gravure de H. Fletcher, XVIIIᵉ siècle" },
  magnolia: { w: 820, h: 817, title: "Magnolia — eau-forte d'après G. D. Ehret" },
  eucalyptus: { w: 820, h: 987, title: "Eucalyptus globulus — gravure, XIXᵉ siècle" },
  olivier: { w: 820, h: 880, title: "Olivier — gravure, XVIIIᵉ siècle" },
  graminee: { w: 820, h: 1630, title: "Brize intermédiaire — gravure d'après J. Sowerby" },
  muflier: { w: 820, h: 1372, title: "Muflier des champs — gravure, XIXᵉ siècle" },
  brins: { w: 820, h: 418, title: "Brins de tulipe et de chèvrefeuille — eau-forte" },
} as const;

export type PlateName = keyof typeof PLATES;
export const PLATE_NAMES = Object.keys(PLATES) as PlateName[];

export const plateOptions = PLATE_NAMES.map((n) => ({ value: n, label: `${n} — ${PLATES[n].title}` }));

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Mots-clés → planche (le premier qui correspond l'emporte)
const KEYWORDS: [RegExp, PlateName][] = [
  [/violette/, "violette"],
  [/pensee/, "pensee"],
  [/pivoine/, "pivoine"],
  [/dahlia/, "dahlia"],
  [/tulipe/, "tulipe"],
  [/renoncule/, "renoncule"],
  [/anemone/, "anemone"],
  [/julienne|lisianthus/, "julienne"],
  [/\blys\b|lilii/, "lys"],
  [/iris|hortensia/, "iris"],
  [/muflier/, "muflier"],
  [/eucalyptus/, "eucalyptus"],
  [/fougere|monstera|gaia|jungle/, "fougere"],
  [/olivier|ficus|bonsai|topiaire|buis/, "olivier"],
  [/gramin|seche|terebell|lagurus/, "graminee"],
  [/lavande|couronne/, "brins"],
  [/chrysanth|toussaint/, "bouquet-ancien"],
  [/magnolia|croix|bougainvill/, "magnolia"],
  [/matricaire|bleuet/, "bleuet"],
  [/rouge|passion|valentin|cupidon|prune/, "eglantier"],
  [/rose/, "rose"],
  [/blanc|deuil|hommage|gerbe/, "anemone-lys"],
];

const BY_CATEGORY: Record<string, PlateName> = {
  cat_bouquets: "bouquet-ancien",
  cat_compositions: "renoncule",
  cat_plantes: "fougere",
  cat_sechees: "graminee",
  cat_deuil: "lys",
  cat_fetes: "pensee",
};

export const isPlate = (s?: string | null): s is PlateName => !!s && s in PLATES;

/** Planche associée à un produit, une catégorie ou une fleur (choix de l'admin, sinon déduite du nom). */
export function plateFor(item: { plate?: string | null; name?: string; subtitle?: string; categoryId?: string; id?: string; slug?: string }): PlateName {
  if (isPlate(item.plate)) return item.plate;
  const text = norm(`${item.name || ""} ${item.subtitle || ""} ${item.slug || ""}`);
  for (const [re, plate] of KEYWORDS) if (re.test(text)) return plate;
  return (item.categoryId && BY_CATEGORY[item.categoryId]) || (item.id && BY_CATEGORY[item.id]) || "violette";
}
