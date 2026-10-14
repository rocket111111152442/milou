# Site MD Services — jardinier, Six-Fours-les-Plages

Site statique (HTML/CSS/JS, aucune dépendance). Ouvrir `index.html` ou déployer le dossier tel quel (Netlify, Vercel, OVH, GitHub Pages…).

## À compléter avant mise en ligne

Tout se règle en haut de `assets/js/main.js` :

```js
window.MD_CONFIG = {
  phone: "06 12 34 56 78",          // numéro réel → remplit tous les boutons « Appeler »
  email: "contact@exemple.fr",      // reçoit les demandes du formulaire (via FormSubmit.co)
  ...
};
```

- **Formulaire** : envoyé via [FormSubmit.co](https://formsubmit.co) (gratuit, sans compte). Au premier envoi, FormSubmit envoie un e-mail de confirmation à l'adresse configurée : il faut cliquer le lien une fois pour activer.
- **Photos** : `assets/img/` contient 4 photos en haute définition issues de la fiche Google de l'entreprise (avec son accord à obtenir).
- **Horaires** : seul « ouvre à 7h30 » est connu ; compléter si besoin dans `contact.html`.

## Pages

- `index.html` — accueil : vidéo de fond en boucle (`assets/video/`, générée par IA : ambiance, pas une réalisation), météo réelle via Open-Meteo, services, cadran des saisons interactif, réalisations, avis, étapes, CTA.
- `contact.html` — devis en 3 étapes, coordonnées, carte, itinéraire.
