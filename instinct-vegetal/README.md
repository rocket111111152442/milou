# Site — Instinct Végétal (paysagiste, Six-Fours-les-Plages)

Site statique (HTML/CSS/JS, aucune dépendance ni build). Ouvrir `index.html` ou déployer le dossier tel quel (Netlify, Vercel, OVH, GitHub Pages…).

- `index.html` : accueil (hero génératif, météo live, savoir-faire, plan → jardin, réalisations en défilement horizontal, méthode, avis, zone, CTA)
- `contact.html` : formulaire de devis en 4 étapes + coordonnées + carte
- `mentions-legales.html` : **à compléter** (SIRET, forme juridique, hébergeur)

## Avant mise en ligne
1. **Formulaire** : dans `assets/js/contact.js`, renseigner `FORM_ENDPOINT` (ex. Formspree). Sans ça, le formulaire propose d'envoyer le récapitulatif par SMS ou d'appeler.
2. **Photos** : `real-1.jpg` / `real-2.jpg` sont recadrées depuis une capture de la fiche Google, donc en basse résolution. Les remplacer par les originaux. Les photos marquées « Inspiration » viennent d'Unsplash : les remplacer par de vrais chantiers dès que possible.
3. **Contenus à valider** avec l'entreprise : liste des services, communes desservies, horaires.
