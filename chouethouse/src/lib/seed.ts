import type { Activity, Post } from "./types";

const A = (a: Omit<Activity, "published" | "sessions"> & Partial<Pick<Activity, "published" | "sessions">>): Activity => ({
  published: true,
  sessions: [],
  ...a,
});

/**
 * Données de départ reprises du site Wix actuel (noms, âges, tarifs, descriptions).
 * Les séances datées proviennent des plannings Wix (dates de fin de série) :
 * à vérifier / compléter depuis l'espace admin.
 */
export const SEED_ACTIVITIES: Activity[] = [
  A({
    id: "a-cinq-sens-12m",
    slug: "5-sens-en-eveil-12-mois-4-ans",
    title: "5 sens en éveil",
    kind: "atelier",
    category: "eveil",
    ageLabel: "12 mois – 4 ans",
    price: 20,
    duration: "1 h",
    image: "/images/ateliers/cinq-sens.webp",
    featured: true,
    description:
      "Plongez dans un voyage sensoriel avec votre tout-petit. Cet atelier invite parents et enfants à explorer les 5 sens à travers des activités ludiques et stimulantes : textures à toucher, sons à écouter et créations à réaliser autour d'une thématique différente à chaque séance.",
  }),
  A({
    id: "a-cinq-sens-3-5",
    slug: "5-sens-en-eveil-3-5-ans",
    title: "5 sens en éveil – grands",
    kind: "atelier",
    category: "eveil",
    ageLabel: "3 – 5 ans",
    price: 20,
    duration: "1 h",
    image: "/images/ateliers/cinq-sens.webp",
    description:
      "La version « grands » de notre atelier sensoriel : toucher, écouter, sentir, goûter et créer autour d'un thème qui change à chaque séance. Un moment de découverte et de complicité parent-enfant.",
  }),
  A({
    id: "a-mini-english-6m-3a",
    slug: "mini-english-6-mois-3-ans",
    title: "Mini English",
    kind: "atelier",
    category: "anglais",
    ageLabel: "6 mois – 3 ans",
    price: 22,
    duration: "1 h",
    host: "Lauren",
    image: "/images/ateliers/mini-english.webp",
    featured: true,
    description:
      "En duo parent-enfant. Lauren, native d'Angleterre, fait découvrir l'anglais aux tout-petits avec des comptines, des jeux et des activités ludiques : une première immersion douce et joyeuse.",
    sessions: [{ id: "s-me1", date: "2026-11-28", start: "10:45", end: "11:45" }],
  }),
  A({
    id: "a-mini-english-6m-6a",
    slug: "mini-english-6-mois-6-ans",
    title: "Mini English – fratrie",
    kind: "atelier",
    category: "anglais",
    ageLabel: "6 mois – 6 ans",
    price: 22,
    duration: "1 h",
    host: "Lauren",
    image: "/images/ateliers/mini-english.webp",
    description:
      "En duo parent-enfant, ouvert à toute la fratrie de 6 mois à 6 ans. Chansons, histoires et jeux pour découvrir l'anglais ensemble, en famille.",
    sessions: [{ id: "s-me2", date: "2026-11-28", start: "09:45", end: "10:45" }],
  }),
  A({
    id: "a-mini-english-3-6",
    slug: "mini-english-3-6-ans",
    title: "Mini English – 3 / 6 ans",
    kind: "atelier",
    category: "anglais",
    ageLabel: "3 – 6 ans",
    price: 22,
    duration: "1 h",
    host: "Lauren",
    image: "/images/ateliers/mini-english.webp",
    description:
      "En duo parent-enfant. Des activités ludiques et créatives pour enrichir son vocabulaire et oser parler anglais, dans un environnement immersif et bienveillant.",
  }),
  A({
    id: "a-english-baby-sensory",
    slug: "english-baby-sensory-6-mois-3-ans",
    title: "English Baby Sensory",
    kind: "atelier",
    category: "anglais",
    ageLabel: "6 mois – 3 ans",
    price: 20,
    host: "Lauren",
    image: "/images/ateliers/baby-sensory.webp",
    description:
      "Lauren, native d'Angleterre, anime des ateliers parents-enfants et fait découvrir l'anglais en s'amusant avec des activités sensorielles. Un environnement immersif pour découvrir l'anglais en famille, tout en partageant un moment convivial et enrichissant.",
  }),
  A({
    id: "a-immersion-anglais",
    slug: "immersion-anglais-5-11-ans",
    title: "Immersion en anglais avec Lauren",
    kind: "stage",
    category: "anglais",
    ageLabel: "5 – 11 ans",
    price: 50,
    priceNote: "190 € la semaine",
    host: "Lauren",
    image: "/images/ateliers/immersion-anglais.webp",
    featured: true,
    description:
      "Stage pendant les vacances scolaires : approfondir le vocabulaire, gagner en confiance, s'amuser et s'exprimer en anglais grâce à des activités créatives, du théâtre et de la pâtisserie.",
  }),
  A({
    id: "a-patisserie",
    slug: "atelier-patisserie-12-mois-4-ans",
    title: "Atelier pâtisserie",
    kind: "atelier",
    category: "creatif",
    ageLabel: "12 mois – 4 ans",
    price: 20,
    duration: "45 min",
    host: "Armelle",
    image: "/images/ateliers/patisserie.webp",
    featured: true,
    description:
      "Apprendre en s'amusant ! Les petits chefs mettent la main à la pâte et repartent avec leur gâteau. Un résultat toujours magique…",
  }),
  A({
    id: "a-eveil-musical",
    slug: "eveil-musical",
    title: "Éveil musical",
    kind: "atelier",
    category: "musique-danse",
    ageLabel: "Tout-petits",
    price: 15,
    duration: "45 min",
    image: "/images/ateliers/eveil-musical.webp",
    description:
      "Comptines, livres et découverte d'instruments sont les maîtres mots de cet atelier pour éveiller l'oreille et le rythme des tout-petits.",
  }),
  A({
    id: "a-comptines-signes",
    slug: "comptines-bebes-signes-0-6-ans",
    title: "Comptines & bébés signes",
    kind: "atelier",
    category: "eveil",
    ageLabel: "0 – 6 ans",
    price: 20,
    image: "/images/ateliers/comptines.webp",
    description:
      "Des comptines accompagnées de signes pour communiquer avec bébé avant les mots. Un atelier doux pour enrichir la relation parent-enfant.",
    sessions: [{ id: "s-cs1", date: "2026-12-05", start: "09:45", end: "10:45" }],
  }),
  A({
    id: "a-danse-0-6",
    slug: "danse-parents-enfants-0-6-ans",
    title: "Danse parents-enfants",
    kind: "atelier",
    category: "musique-danse",
    ageLabel: "0 – 6 ans",
    price: 20,
    image: "/images/ateliers/danse.webp",
    featured: true,
    description:
      "On bouge ensemble ! Un moment de danse joyeux et complice pour partager le plaisir du mouvement en musique avec son enfant.",
    sessions: [{ id: "s-da1", date: "2026-12-05", start: "10:45", end: "11:45" }],
  }),
  A({
    id: "a-danse-15m-6a",
    slug: "danse-parents-enfants-15-mois-6-ans",
    title: "Danse parents-enfants – 15 mois / 6 ans",
    kind: "atelier",
    category: "musique-danse",
    ageLabel: "15 mois – 6 ans",
    price: 15,
    duration: "Durée variable",
    image: "/images/ateliers/danse.webp",
    description: "Danser, sauter, tourner : un atelier en duo pour se dépenser et rire ensemble.",
  }),
  A({
    id: "a-messy-play",
    slug: "messy-play-parent-enfant-12-mois-4-ans",
    title: "Messy Play",
    kind: "atelier",
    category: "creatif",
    ageLabel: "12 mois – 4 ans",
    price: 15,
    image: "/images/ateliers/messy-play.webp",
    description:
      "Le droit de se salir ! Peinture, textures et matières à manipuler librement, en duo parent-enfant, pour stimuler la créativité et les sens.",
  }),
  A({
    id: "a-body-painting",
    slug: "body-painting",
    title: "Body Painting",
    kind: "atelier",
    category: "creatif",
    ageLabel: "Enfants",
    price: 20,
    image: "/images/ateliers/body-painting.webp",
    description: "Des couleurs plein les mains (et partout ailleurs) : un atelier de peinture corporelle festif et créatif.",
  }),
  A({
    id: "a-reflexologie",
    slug: "reflexologie-plantaire-parents-enfants-0-12-mois",
    title: "Réflexologie plantaire parents-enfants",
    kind: "atelier",
    category: "bien-etre",
    ageLabel: "0 – 12 mois",
    price: 20,
    image: "/images/ateliers/reflexologie.webp",
    description: "Apprenez des gestes simples de réflexologie plantaire pour apaiser et détendre votre bébé.",
  }),
  A({
    id: "a-massage-bebe",
    slug: "initiation-massage-bebe-1-mois-1-an",
    title: "Initiation massage bébé",
    kind: "atelier",
    category: "bien-etre",
    ageLabel: "1 mois – 1 an",
    price: 20,
    priceNote: "Duo parent-bébé",
    image: "/images/ateliers/reflexologie.webp",
    featured: true,
    description:
      "En duo parent-bébé : découvrez les gestes du massage pour bébé, un moment de tendresse qui favorise la détente et le lien.",
    sessions: [{ id: "s-mb1", date: "2026-12-14", start: "10:00", end: "11:00" }],
  }),
  A({
    id: "a-cercle-mamans",
    slug: "cercle-de-futures-mamans",
    title: "Cercle de (futures) mamans",
    kind: "atelier",
    category: "parentalite",
    ageLabel: "Mamans & futures mamans",
    price: 35,
    duration: "2 h",
    image: "/images/ateliers/cercle-mamans.webp",
    description:
      "Un temps d'échange bienveillant entre (futures) mamans : partager son vécu, poser ses questions et se ressourcer, autour d'un bon café.",
  }),
  A({
    id: "a-auto-coaching",
    slug: "atelier-auto-coaching-auto-massage",
    title: "Auto-coaching & auto-massage",
    kind: "atelier",
    category: "bien-etre",
    ageLabel: "Adultes",
    price: 70,
    priceNote: "2 ateliers",
    image: "/images/ateliers/auto-coaching.webp",
    description: "Deux ateliers pour prendre soin de soi : ralentir et apprendre à s'écouter, puis s'initier à l'auto-massage du visage.",
  }),
  A({
    id: "a-retraite-enchantee",
    slug: "mini-retraite-enchantee-filles-6-10-ans",
    title: "Mini retraite enchantée",
    kind: "evenement",
    category: "bien-etre",
    ageLabel: "Filles 6 – 10 ans",
    price: 50,
    image: "/images/ateliers/retraite-enchantee.webp",
    featured: true,
    description: "Une parenthèse enchantée réservée aux filles de 6 à 10 ans : bien-être, créativité et confiance en soi, dans une ambiance douce et magique.",
    sessions: [{ id: "s-re1", date: "2026-12-12", start: "10:00", end: "11:30" }],
  }),
  A({
    id: "a-chouet-foraine",
    slug: "chouet-foraine",
    title: "Chouet'Foraine",
    kind: "evenement",
    category: "creatif",
    ageLabel: "18 mois – 6 ans",
    price: 20,
    image: "/images/ateliers/chouet-foraine.webp",
    description: "La fête foraine version Chouet'House : stands de jeux, attractions et gourmandises pour les petits.",
  }),
  A({
    id: "a-bourse-jouets",
    slug: "bourse-aux-jouets",
    title: "Bourse aux jouets",
    kind: "evenement",
    category: "parentalite",
    ageLabel: "Tout public",
    price: 10,
    priceNote: "Emplacement exposant",
    image: "/images/ateliers/bourse-jouets.webp",
    description: "Videz les coffres à jouets et faites de bonnes affaires ! Réservez votre emplacement pour vendre jouets, livres et jeux d'enfants.",
  }),
  A({
    id: "a-halloween",
    slug: "danse-speciale-halloween",
    title: "Danse spéciale Halloween",
    kind: "evenement",
    category: "musique-danse",
    ageLabel: "15 mois – 6 ans",
    price: 15,
    image: "/images/ateliers/halloween.webp",
    published: false,
    description: "Déguisements bienvenus ! Une séance de danse parents-enfants aux couleurs d'Halloween.",
  }),
];

export const SEED_POSTS: Post[] = [
  {
    id: "p-bienvenue",
    slug: "bienvenue-chez-chouet-house-coffee-shop-familial-la-seyne-sur-mer",
    title: "Bienvenue chez Chouet'House, le coffee shop familial de La Seyne-sur-Mer",
    excerpt:
      "Brunchs, cookies maison, ateliers d'éveil et anniversaires : découvrez notre cocon pensé pour les parents et les enfants.",
    cover: "/images/table-brunch.webp",
    tags: ["Chouet'House", "Coffee shop"],
    published: true,
    date: "2026-11-20",
    content: `Chouet'House, c'est un **coffee shop familial** installé avenue Pierre Auguste Renoir, à La Seyne-sur-Mer. Un lieu où les parents peuvent enfin savourer un bon café pendant que les enfants jouent, découvrent et s'épanouissent.

## Un lieu gourmand…

Nous proposons une **petite restauration fraîche et de saison** : brunchs, tartines, douceurs et nos fameux **cookies maison**, préparés avec amour pour régaler petits et grands.

## … et pensé pour les familles

Toute la semaine, notre programme d'**ateliers parents-enfants** accueille les tout-petits dès quelques mois : éveil sensoriel, anglais avec Lauren, danse, musique, pâtisserie, massage bébé…

Nous organisons aussi des **anniversaires** inoubliables et des **stages ludiques** pendant les vacances scolaires.

## Infos pratiques

- 📍 2496 avenue Pierre Auguste Renoir, 83500 La Seyne-sur-Mer
- 🕘 Du lundi au samedi, 9 h – 18 h
- 📞 09 56 60 77 74

À très vite chez Chouet'House !`,
  },
  {
    id: "p-que-faire-bebe",
    slug: "que-faire-avec-un-bebe-a-la-seyne-sur-mer",
    title: "Que faire avec un bébé ou un tout-petit à La Seyne-sur-Mer ?",
    excerpt:
      "Éveil sensoriel, bébés signes, massage bébé, anglais dès 6 mois : nos idées d'activités pour les 0-4 ans près de Toulon.",
    cover: "/images/ateliers/cinq-sens.webp",
    tags: ["Ateliers", "Bébé", "Idées sorties"],
    published: true,
    date: "2026-11-15",
    content: `Trouver une activité adaptée aux tout-petits dans la région toulonnaise n'est pas toujours simple. Chez Chouet'House, nous avons imaginé des **ateliers parents-enfants** dès le plus jeune âge.

## Dès la naissance

- **Initiation massage bébé** (1 mois – 1 an) : des gestes simples pour apaiser bébé.
- **Réflexologie plantaire** (0 – 12 mois) : détente et complicité.
- **Comptines & bébés signes** (0 – 6 ans) : communiquer avant les mots.

## À partir de 6 mois

- **Mini English** et **English Baby Sensory** avec Lauren, native d'Angleterre : une première immersion en anglais, en jouant.

## À partir de 12 mois

- **5 sens en éveil** : textures, sons et créations autour d'un thème différent à chaque séance.
- **Messy Play** : le droit de se salir pour mieux découvrir !
- **Atelier pâtisserie** : les petits chefs repartent avec leur gâteau.

Consultez le [planning des ateliers](/ateliers-enfants) et réservez votre place.`,
  },
  {
    id: "p-anniversaire",
    slug: "organiser-anniversaire-enfant-la-seyne-sur-mer-toulon",
    title: "Organiser l'anniversaire de son enfant près de Toulon : nos conseils",
    excerpt:
      "Âge, nombre d'invités, déroulé : nos conseils pour un anniversaire réussi, sans stress pour les parents.",
    cover: "/images/gateau-anniversaire.webp",
    tags: ["Anniversaires", "Conseils"],
    published: true,
    date: "2026-11-08",
    content: `Un anniversaire réussi, c'est un enfant qui s'amuse… et des parents qui profitent aussi ! Voici quelques conseils avant de vous lancer.

## 1. Adapter la fête à l'âge

Avant 3 ans, privilégiez un format court et calme. Entre 3 et 6 ans, les enfants adorent les activités créatives et les jeux. Après 6 ans, une animation à thème fait souvent l'unanimité.

## 2. Bien choisir le nombre d'invités

Une règle simple : autant d'invités que l'âge de l'enfant, plus un. Cela permet de garder une ambiance sereine.

## 3. Penser au goûter

Le gâteau reste la star de la fête ! Pensez aussi aux boissons et à une alternative pour les enfants allergiques.

## 4. Déléguer

Chez Chouet'House, nous nous occupons de l'organisation pour que vous profitiez pleinement du moment. Pour une demande, précisez simplement l'âge de l'enfant : [demander une formule anniversaire](/anniversaires).`,
  },
];
