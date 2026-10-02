// Tous les réglages modifiables du hero sont ici.
// Les temps sont en SECONDES et sont automatiquement convertis en images.

export const VIDEO = {
  width: 1920,
  height: 804, // 2.39:1
  fps: 24,
  durationInSeconds: 8,
};

export const COLORS = {
  background: '#0C0E11', // noir "salle de projection"
  ink: '#ECE8E1', // blanc "écran" (texte, logo, surimpression)
  accent: '#E9AA45', // lumière tungstène (faisceau, lueurs)
  rec: '#E8493A', // pastille REC
  leakFrom: '#F06A3A', // light leak : début du dégradé
  leakTo: '#E9AA45', // light leak : fin du dégradé
};

export const TAGLINE = "TOUT CE QUI FAIT L'IMAGE";

// Opacité du grain pellicule (0.04 – 0.06)
export const GRAIN_OPACITY = 0.05;

// Zone de sécurité : marge horizontale (en px) que le site peut recadrer.
// 192 px de chaque côté = 80 % central conservé. La surimpression reste à l'intérieur.
export const SAFE_X = 192;

// Découpage du storyboard (en secondes). Si vous changez la durée totale,
// gardez ces valeurs proportionnelles et terminez `close` avant la fin.
export const TIMING = {
  beamOpen: [0.0, 1.5], // le faisceau s'ouvre
  bladesIn: [1.5, 2.4], // les lames du diaphragme arrivent une à une
  irisToIcon: [2.25, 2.6], // fondu des lames dessinées vers l'icône SVG
  iconBloom: [2.95, 3.55], // l'icône se transforme en lueur
  logoIn: [3.4, 4.1], // le logo apparaît net
  taglineIn: [3.9, 4.5],
  leak: [3.6, 5.1], // light leak de gauche à droite
  dissolve: [5.5, 6.6], // le logo se dissout dans le faisceau
  beamSwell: [5.5, 6.2], // le faisceau s'intensifie pendant la dissolution
  close: [6.2, 7.6], // le faisceau se referme vers le noir (tenu jusqu'à la fin)
};
