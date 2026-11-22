export const SITE = {
  name: "Chouet'House",
  fullName: "Chouet'House – Family Concept",
  tagline: "Coffee shop & lieu familial à La Seyne-sur-Mer",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.chouethouse.fr",
  phone: "09 56 60 77 74",
  phoneHref: "+33956607774",
  email: "chouethouse@gmail.com",
  street: "2496 Avenue Pierre Auguste Renoir (RD 16)",
  postalCode: "83500",
  city: "La Seyne-sur-Mer",
  region: "Var",
  geo: { lat: 43.0847, lng: 5.8586 },
  hours: "Du lundi au samedi, 9 h – 18 h",
  hoursShort: "Lun. – Sam. · 9 h – 18 h",
  rating: { value: 4.9, count: 136 },
  priceRange: "20–30 €",
  instagram: "https://www.instagram.com/chouethouse/",
  facebook: "https://www.facebook.com/chouethouse/",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Chouet%27house+Family+Concept+2496+Av.+Pierre+Auguste+Renoir+83500+La+Seyne-sur-Mer",
  mapsEmbed:
    "https://www.google.com/maps?q=Chouet%27house+Family+Concept,+2496+Av.+Pierre+Auguste+Renoir,+83500+La+Seyne-sur-Mer&output=embed",
};

export const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/restaurant-brunch", label: "Restauration" },
  { href: "/ateliers-enfants", label: "Ateliers" },
  { href: "/anniversaires", label: "Anniversaires" },
  { href: "/evenements", label: "Événements" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];
