# Refonte de aei-var.com (maquette de prospection)

Maquette statique (HTML/CSS/JS, sans dépendance) d'une refonte du site de
**Agence Européenne Immobilière – Côté Mer** (AEI Côté Mer), à Six-Fours-les-Plages.

Ouvrir `index.html`, ou lancer `python3 -m http.server` dans ce dossier.

## Ce qui a été repris du site actuel
- Couleurs : celles du logo, bleu marine `#1e146a` et rouge bordeaux `#a3262a`.
- Contenus : textes de présentation, services, équipe (photos, rôles, téléphones), coordonnées, 10 biens mis en avant.
- Photos : téléchargées depuis le site actuel et converties en WebP (2,2 Mo au total).

## Analyse : ce dont l'agence a besoin
| Constat sur le site actuel | Ce que propose la maquette |
|---|---|
| Template La Boîte Immo, utilisé par des centaines d'agences | Identité propre, typographie éditoriale haut de gamme |
| HTML de 590 Ko et 22 scripts | Une page légère, sans librairie externe |
| Estimation = simple bouton | Formulaire en 4 étapes : c'est le meilleur levier pour obtenir des mandats vendeurs |
| Avis Google enfouis dans le footer | Note moyenne et avis mis en avant |
| Adresses e-mail Gmail | **À corriger côté agence** : passer sur un domaine (`@aei-var.com`) |
| Aucune page par ville | Bloc « Secteurs » à transformer en pages SEO locales (Six-Fours, Sanary…) |
| Mobile : pas d'action rapide | Barre fixe « Appeler / Estimer » sur mobile |

Données vérifiées : SARL créée en mars 2017, RCS Toulon, 1 à 2 salariés.
Sur PagesJaunes : 73 avis (53 à 5 étoiles, 20 à 4), mais tous datent de 2021.
Je n'ai pas pu récupérer la note Google : Google bloque la lecture automatique de la fiche.

## Points à vérifier avant de montrer la maquette
1. **Flux d'annonces.** Les 153 annonces de l'agence sont synchronisées par La Boîte Immo depuis leur logiciel métier.
   Un site sur mesure doit reprendre ce flux (export XML/API du logiciel : Apimo, Hektor, AC3…).
   Sinon l'agence perd sa mise à jour automatique : c'est l'objection n°1 à anticiper.
2. **Engagements écrits dans la maquette**, à faire valider par l'agence : « réponse sous 48 h »,
   « capacité de financement vérifiée », la liste des quartiers par ville.
3. **Avis** : seule la citation « Très bonne agence. Très professionnelle. » est un vrai avis.
   Remplacer par de vrais avis Google récents (widget ou intégration API).
4. **Formulaires** : ils affichent un message de succès, mais rien n'est envoyé. Il faut les brancher (CRM, Formspree, e-mail) : voir les `TODO` dans `main.js`.
5. **Légal** : mentions légales, barème des honoraires (affichage obligatoire), RGPD et cookies.
6. Les photos et la marque appartiennent à l'agence. Ne pas mettre la maquette en ligne publiquement sans leur accord.

## Animations incluses
Écran de chargement avec le logo, apparition des titres ligne par ligne, diaporama avec effet Ken Burns, défilement des villes,
apparitions au scroll en cascade, compteurs animés, parallaxe, boutons magnétiques, inclinaison 3D des cartes équipe,
filtres de biens animés, formulaire avec étapes et validation animée.
Toutes les animations se coupent si le visiteur a activé `prefers-reduced-motion`.

## Espace d'administration (`/admin`)
- Adresse : `/admin`. Mot de passe : variable `ADMIN_PASSWORD` dans les réglages du projet Vercel.
- Permet d'ajouter, modifier, supprimer et réordonner les biens, avec jusqu'à 30 photos par bien (la première est la photo principale). Sur le site, un clic sur la photo ouvre la galerie plein écran.
  Les photos sont redimensionnées à 1600 px et converties en WebP dans le navigateur avant l'envoi.
- Les biens sont stockés dans Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Les 5 dernières versions sont gardées en secours.
  Tant que rien n'a été enregistré, le site affiche `data/biens.json`.
- Les modifications apparaissent sur le site immédiatement, sans redéploiement.
- Limites : un seul mot de passe partagé, et pas de limitation de tentatives au-delà d'un délai de 0,8 s par erreur.
  Si deux personnes enregistrent en même temps, c'est la dernière sauvegarde qui est gardée.
  Supprimer un bien ne supprime pas sa photo du stockage Blob.
