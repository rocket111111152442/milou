/* =========================================================
   Monceau Fleurs — La Seyne-sur-Mer
   Toutes les données éditables du site sont ici.
   ========================================================= */
window.MF = {
  config: {
    shop: "Monceau Fleurs",
    city: "La Seyne-sur-Mer",
    street: "2459 Avenue Pierre-Auguste Renoir (RD 16)",
    zip: "83500",
    phone: "", // À compléter, ex. "04 94 00 00 00" — les boutons d'appel apparaissent automatiquement
    email: "", // À compléter
    rating: 4.5,
    reviews: 749,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Monceau+Fleurs+2459+Avenue+Pierre-Auguste+Renoir+83500+La+Seyne-sur-Mer",
    // Horaires : 0 = dimanche … 6 = samedi (source : fiche magasin monceaufleurs.com)
    hours: {
      0: ["08:30", "14:00"],
      1: ["08:30", "20:00"],
      2: ["08:30", "20:00"],
      3: ["08:30", "20:00"],
      4: ["08:30", "20:00"],
      5: ["08:30", "20:00"],
      6: ["08:30", "20:00"]
    }
  },

  // Prix indicatifs — à remplacer par le catalogue de la boutique
  products: [
    { id: "romantique", name: "Le Romantique", cats: ["amour", "anniversaire"], tag: "Best-seller", price: 49, img: "1591886960571-74d43a9d4166", desc: "Roses poudrées et fleurs de saison, un bouquet rond, généreux et tendre." },
    { id: "passion", name: "Passion Rouge", cats: ["amour"], tag: "Amour", price: 59, img: "1494972308805-463bc619d34e", desc: "Roses rouges grand calibre : la déclaration intemporelle." },
    { id: "riviera", name: "Riviera", cats: ["anniversaire", "merci"], tag: "Nouveau", price: 45, img: "1533616688419-b7a585564566", desc: "Roses orangées, mufliers et chardons : un éclat de soleil varois." },
    { id: "printemps", name: "Tulipes Fraîches", cats: ["anniversaire", "merci"], price: 32, img: "1561181286-d3fee7d55364", desc: "Une botte de tulipes, simple et lumineuse, qui s'ouvre de jour en jour." },
    { id: "sorbet", name: "Pivoines Sorbet", cats: ["amour", "naissance"], tag: "Selon arrivage", price: 64, img: "1582794543139-8ac9cb0f7b11", desc: "Pivoines roses en pleine éclosion, le luxe de la saison." },
    { id: "boheme", name: "Bohème", cats: ["merci", "anniversaire"], price: 39, img: "1567696153798-9111f9cd3d0d", desc: "Bouquet champêtre noué main, tournesol et feuillages, emballage kraft." },
    { id: "lys", name: "Lys Étoile", cats: ["anniversaire", "merci"], price: 42, img: "1502977249166-824b3a8a4d6d", desc: "Lys parfumés aux pétales tigrés, d'une élégance graphique." },
    { id: "hommage", name: "Hommage Blanc", cats: ["deuil"], tag: "Deuil", price: 79, img: "1495231916356-a86217efff12", desc: "Roses blanches et feuillages nobles pour accompagner un dernier adieu." },
    { id: "douceur", name: "Douceur Poudrée", cats: ["naissance", "amour"], price: 55, img: "1563241527-3004b7be0ffd", desc: "Roses pêche, gypsophile et eucalyptus dans un nuage de tendresse." },
    { id: "anthurium", name: "Anthurium", cats: ["plantes"], price: 34, img: "1567748157439-651aca2ff064", desc: "Plante d'intérieur graphique, floraison longue durée, entretien facile." },
    { id: "hortensia", name: "Hortensia Bleu", cats: ["plantes", "merci"], price: 36, img: "1471696035578-3d8c78d99684", desc: "Un hortensia aux pompons bleu intense, en pot." },
    { id: "coeur", name: "Cœur Fleuri", cats: ["amour"], tag: "Coup de cœur", price: 89, img: "1526047932273-341f2a7631f9", desc: "Composition en forme de cœur, roses et fleurs vives." },
    { id: "soleil", name: "Soleil", cats: ["anniversaire", "merci"], price: 35, img: "1455659817273-f96807779a8a", desc: "Des tournesols éclatants pour faire entrer l'été dans la maison." },
    { id: "ficus", name: "Ficus Élégant", cats: ["plantes"], price: 39, img: "1477554193778-9562c28588c0", desc: "Un feuillage vert profond qui purifie et apaise votre intérieur." },
    { id: "pastel", name: "Jardin Pastel", cats: ["amour", "naissance"], price: 52, img: "1596438459194-f275f413d6ff", desc: "Roses et œillets pastel, un bouquet aux airs de jardin anglais." },
    { id: "solitaire", name: "Rose Solitaire", cats: ["amour", "deuil"], price: 15, img: "1518895949257-7621c3c786d7", desc: "Une rose, un vase, et tout est dit." }
  ],

  sizes: [
    { id: "classique", label: "Classique", add: 0 },
    { id: "genereux", label: "Généreux", add: 15 },
    { id: "prestige", label: "Prestige", add: 30 }
  ],

  // Atelier : compositeur de bouquet
  flowers: [
    { id: "rose", name: "Rose", price: 4.5, color: "#c8203f" },
    { id: "pivoine", name: "Pivoine", price: 6.9, color: "#f2a3b5" },
    { id: "tulipe", name: "Tulipe", price: 2.9, color: "#f0627f" },
    { id: "renoncule", name: "Renoncule", price: 3.9, color: "#f29b38" },
    { id: "tournesol", name: "Tournesol", price: 3.5, color: "#f5c518" },
    { id: "lys", name: "Lys", price: 5.5, color: "#f6e9ee" },
    { id: "gypso", name: "Gypsophile", price: 2.5, color: "#ffffff" },
    { id: "euca", name: "Eucalyptus", price: 2.0, color: "#8fa98a" }
  ],
  wraps: [
    { id: "kraft", name: "Kraft naturel", price: 3, color: "#c9a27a", dark: "#a8825c" },
    { id: "bleu", name: "Bleu Monceau", price: 4, color: "#24335c", dark: "#18213d" },
    { id: "blanc", name: "Blanc nacré", price: 4, color: "#f4efe8", dark: "#d9d1c4" },
    { id: "rose", name: "Rose poudré", price: 4, color: "#ebc5c5", dark: "#cfa1a3" }
  ],

  // Zones de livraison — exemples à valider avec la boutique
  zones: [
    { zip: ["83500"], city: "La Seyne-sur-Mer", fee: 6.9 },
    { zip: ["83140"], city: "Six-Fours-les-Plages", fee: 8.9 },
    { zip: ["83430"], city: "Saint-Mandrier-sur-Mer", fee: 8.9 },
    { zip: ["83190"], city: "Ollioules", fee: 8.9 },
    { zip: ["83110"], city: "Sanary-sur-Mer", fee: 9.9 },
    { zip: ["83000", "83100", "83200"], city: "Toulon", fee: 9.9 }
  ]
};
