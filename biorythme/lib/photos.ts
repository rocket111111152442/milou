// Photos du club, reprises de l'ancien site biorythme.fr.
// scripts/fetch-photos.mjs les copie dans public/photos/ au build ;
// si la copie échoue, le composant Photo charge l'original.

const BASE = "https://www.biorythme.fr/uploads";
const SIZE = "767x0_2560x0";

export const PHOTOS = {
  studioSteps: { path: "t6vxBRPM/05170477-788E-48B2-9BBD-B23973E98A4A_1_105_c_432.jpeg", alt: "Studio de cours collectifs avec steps" },
  muscuFauteuils: { path: "z97M0RNA/A546EF7A-B09E-4FD2-A02C-BE7C3C52A16A_1_201_a.jpeg", alt: "Espace de musculation" },
  stepsLumiere: { path: "ro6qxOqC/94C3629F-EA9B-4F49-B653-F11CD3D48D23_1_105_c.jpeg", alt: "Steps dans un studio éclairé" },
  salleRouge: { path: "asjOD2MD/A7AB1A90-0762-4D7F-B34C-2651ADB7D71B_1_105_c.jpeg", alt: "Grande salle de cours collectifs" },
  virtualBike: { path: "rVqU7qDw/981CA457-F50F-4350-98BD-1E94D0D8466F_1_105_c.jpeg", alt: "Vélo du studio Bike" },
  studioTapis: { path: "q3oP3Cac/73CDA4BA-9343-4B9E-9230-6C7415AE5F1F_1_105_c.jpeg", alt: "Studio avec tapis de sol" },
  coursRenfo: { path: "mQ6LQMHw/F46F8270-FD20-4027-B200-391D8A0BDC64_1_105_c.jpeg", alt: "Cours de renforcement musculaire" },
  machines: { path: "4j8cw3pc/BB145EC0-F6F3-4F56-8F07-285E936F331F_1_105_c_633.jpeg", alt: "Machines de musculation et de cardio" },
  accueil: { path: "yeLCAh8C/6793C53D-1E8E-459B-9E5C-F1CE69DD211E_1_105_c.jpeg", alt: "Accueil du club" },
  cycling: { path: "uuQWKnzW/EDB05D15-DC52-43DB-98B0-5CA227886EFE_1_105_c.jpeg", alt: "Studio de cycling" },
  cardio: { path: "aRQWPi82/D9053DF6-89D9-4767-BAD1-6D3907493783_1_105_c.jpeg", alt: "Zone de cardio-training" },
  fonctionnel: { path: "7A9UteRU/82FB020D-5350-4E1E-8D3F-08E2C10592DD_1_105_c.jpeg", alt: "Zone fonctionnelle avec racks et rameurs" },
  halteres: { path: "DXWJRzAV/0D51E600-7A09-48D7-8BA6-C85A8C7B93E9_1_105_c.jpeg", alt: "Haltères, bancs et machines de musculation" },
  groupe: { path: "8kKaEj6a/F67F4AB5-1530-4545-8051-C1D0FA975A7F_1_201_a.jpeg", alt: "Photo de groupe lors d'un événement" },
} as const;

export type PhotoKey = keyof typeof PHOTOS;

export const photoRemote = (key: PhotoKey) => {
  const [id, file] = PHOTOS[key].path.split("/");
  return `${BASE}/${id}/${SIZE}/${file}`;
};

export const photoLocal = (key: PhotoKey) => `/photos/${key}.jpeg`;

/** Props prêtes pour <Photo />. */
export const photo = (key: PhotoKey) => ({ src: photoLocal(key), fallback: photoRemote(key), alt: PHOTOS[key].alt });
