# Bilan — Acor’Immo (19 octobre 2026)

Adaptation, pour Acor’Immo, de la solution construite pour AEI Côté Mer (dossier `../aei-var-redesign`, non modifié).
Même architecture et mêmes fonctions ; identité, contenus et annonces remplacés. Site en ligne de démonstration :
https://acorimmo.vercel.app (projet Vercel `acorimmo`, distinct de `aei-cote-mer`), en **noindex** tant que l’agence
n’a pas validé.

## Ce qui a été relevé, et où (relevés du 19/10/2026)

| Information | Source | Remarque |
|---|---|---|
| 4 agences : La Seyne-sur-Mer (siège, 9 bis rue Amable Lagane, 04 94 30 00 16), Six-Fours-les-Plages (39 rue de la République, 04 94 74 65 69), Sanary-sur-Mer (41 rue Jean Jaurès, 04 94 07 49 20), Toulon (15 avenue Colbert, 04 94 01 26 27) ; e-mail acorimmo@orange.fr | acorimmo.fr (pied de page, page Contact) | Le siège est à La Seyne, pas à Six-Fours |
| Historique (2002, 2011, 2015, 2020, janvier 2025) | acorimmo.fr, page Histoire | |
| Équipe : 23 personnes (direction, 4 agences, location), téléphones, e-mails, photos | acorimmo.fr, page Équipe | |
| SIREN 448 929 091, SIRET du siège 448 929 091 00032, SARL, créée le 13/06/2003, gérante Adeline Boz, NAF 68.31Z | recherche-entreprises.api.gouv.fr | Le site actuel affiche « 448 929 0910 0032 » (chiffre en trop) ; l’annuaire liste 3 établissements ouverts pour 4 agences affichées |
| Médiateur : ANM Conso, 62 rue Tiquetonne, 75002 Paris | acorimmo.fr, mentions légales | |
| Barème d’honoraires (« en vigueur au 10 avril 2024 ») | acorimmo.fr, pages Honoraires et Gestion locative | Garantie loyers impayés : 2 % sur une page, 2,1 % sur l’autre |
| Notes Google : Six-Fours 4,9/5 (153 avis), La Seyne 4,9 (186), Sanary 5,0 (92), Toulon 5,0 (73) | Google Maps, fiche de chaque agence | 4,9/153 confirmé pour Six-Fours ; la note de l’accueil est celle de Six-Fours, les 4 sont sur la page Agences |
| Avis affichés (2) | Avis Google republiés par l’agence sur acorimmo.fr (5 étoiles) | Auteur abrégé ; date limitée à l’année (le site n’affiche que « il y a 2 semaines ») |
| Textes des pages communes (La Seyne, Six-Fours, Sanary, Toulon, Saint-Mandrier) | Articles et pages de vente d’acorimmo.fr | Passages chiffrés (prix au m², volumes) volontairement retirés |
| Couleurs #314452 (ardoise) et #d7b56d (or), logo | Feuille de style et logo d’acorimmo.fr | Version ardoise du logo dérivée de l’original pour les fonds clairs |
| 194 annonces (183 en vente dont 20 vendues, 11 en location) | acorimmo.fr, fiches annonces | Voir « Annonces » ci-dessous |

## Ce qui reste « À compléter » (affiché tel quel, surligné, dans les pages légales)

- Capital social, n° de TVA intracommunautaire, greffe d’immatriculation (RCS).
- Carte professionnelle (n°, mentions « Transactions » / « Gestion », CCI) : **non publiée sur le site actuel**.
- Garantie financière (organisme, montants) et assurance RCP.
- Détention de fonds : l’agence fait de la gestion locative, donc détient a priori des fonds pour le compte de tiers ; à préciser.
- Horaires : le site actuel n’en donne pas ; Google Maps (sans compte) n’affiche que le lundi (9 h – 12 h, 14 h – 18 h).
  La page Espace client affiche « À compléter » à la place des horaires ; l’accueil ne les affiche pas.

## Annonces

- 194 annonces reprises avec titre, description, prix, surfaces, pièces, chambres, salles d’eau/bain, année, cuisine,
  chauffage, DPE/GES (lettre et valeur, d’après l’image affichée par le site), équipements, taxe foncière, charges,
  visite virtuelle Previsite, exclusivité, statut (disponible / sous compromis / vendu). Honoraires : seulement la mention
  affichée par l’annonce (« à la charge du vendeur » pour 131 ventes ; 52 annonces de vente n’en affichent aucune).
- Photos : 8 maximum par bien (3 pour les vendus), redimensionnées en WebP 1 600 px (≈ 1 300 photos, ≈ 210 Mo).
  Les photos d’origine portent le filigrane Acor’Immo.
- Ajustements faits à l’import (et pourquoi) :
  - charges de copropriété : le site affiche des charges **mensuelles**, le modèle les attend **par an** → multipliées par 12 ;
  - 5 places de parking classées « maison » sur le site d’origine → type « Parking » (détecté d’après le titre) ;
  - 1 annonce (AVAP10005945) sans commune → « La Seyne-sur-Mer », reprise de son titre (« LA SEYNE CENTRE ») ;
  - 1 terrain annoncé « à Solliès-Toucas » dans son titre mais situé « Cuers » dans ses données : laissé tel quel ;
  - fonds de commerce → type « Autre » (le modèle n’a pas de type dédié) ; l’étage et le « secteur » ne sont pas repris.
- Non repris : les 6 locations saisonnières (prix à la nuit, que le modèle ne gère pas).
- C’est un **instantané** du 19/10/2026 : prix et disponibilités évolueront sur le site actuel sans être répercutés ici.
  Relancer `scripts/import/` met à jour (voir README), mais il n’existe pas de synchronisation automatique.

## Ce qui fonctionne et a été testé

Tests automatisés (Playwright, Chromium) sur le serveur local (`STORAGE=fs`), bureau 1440 px et mobile (iPhone 13),
avec lecture des captures d’écran : 87 vérifications, toutes réussies après corrections.

- **Site** : accueil (sélection de 9 biens, filtres vente/location/vendus), recherche depuis l’accueil, page `/biens`
  (filtres type/ville/prix/surface/pièces/chambres/équipements, tri), fiches `/bien/<id>` rendues côté serveur avec
  photos et galerie, visite virtuelle (Previsite, chargée après clic), partage, impression, simulateur de mensualités,
  pages communes, Agences, Honoraires, Mentions, Espace client ; FR/EN/DE (accueil vérifié en anglais et en allemand) ;
  aucune image cassée et aucun défilement horizontal sur les pages testées.
- **Formulaires** : contact, estimation en 4 étapes (aucune fourchette affichée : aucun prix au m² saisi), demande de visite,
  favoris, suivi d’une demande par code, alerte e-mail (enregistrée), demande de rendez-vous.
- **Admin** : connexion avec changement imposé du mot de passe provisoire, tableau de bord, biens (liste, édition,
  photos, enregistrement répercuté sur le site), demandes + pipeline, contacts créés automatiquement, critères de recherche
  et biens correspondants, modèles d’e-mails proposés, tâches, mandat rattaché à un bien, agenda des visites, rapports,
  communes & avis (contenu initial Acor’Immo), création d’un utilisateur, admin sur mobile.
- **Production** : voir la section « Vérifications en production » ci-dessous.

## Ce qui est encore de la démonstration

- Les annonces sont un instantané (voir plus haut) ; les comptes rendus, mandats, contacts, tâches de l’admin sont vides.
- Le compte administrateur est provisoire (identifiant `admin@acorimmo.fr`, mot de passe provisoire consultable dans Vercel,
  à changer à la première connexion). Créer ensuite des comptes nominatifs.
- Les visuels d’accueil : panorama de la rade et villa issus du site actuel, deux photos d’annonces (avec filigrane).

## Ce qui dépend d’un service externe

| Fonction | Service | État |
|---|---|---|
| E-mails (accusés de réception, notifications, alertes, mot de passe oublié) | Resend | **Désactivé** : pas de compte. Les demandes sont enregistrées, aucun e-mail ne part. |
| Stockage des données et photos | Vercel Blob privé (`acorimmo-donnees`) | Actif |
| Diffusion SeLoger / Leboncoin, réseau Interkab | Logiciel de l’agence (La Boîte Immo / Hektor, ou autre) | **Non réalisé** : pas d’API publique |
| Synchronisation avec le logiciel de l’agence | API générique `/api/v1` | Utilisée pour l’import initial puis **désactivée** (variable retirée de la production) |
| Carte | Google Maps (après accord du visiteur) | Actif |
| Visite virtuelle | Previsite (après clic) | Actif ; intégration constatée techniquement possible, conditions d’utilisation non vérifiées |

## Limites à rappeler

- Pas de diffusion vers SeLoger/Leboncoin ni Interkab (réseaux de La Boîte Immo/Hektor, pas d’API publique).
- Pas d’estimation instantanée type PriceHubble : seulement une fourchette si l’agence saisit ses prix au m² (aucun aujourd’hui).
- E-mails désactivés sans compte Resend et domaine vérifié.
- Traductions faites dans le navigateur (non indexées) ; textes EN/DE ajoutés pour Acor’Immo non relus par un natif ;
  les annonces restent en français tant que l’agence ne les traduit pas dans l’admin.
- Titres d’annonces repris tels quels (beaucoup en majuscules).
- Les fonctions serveur sont en région Paris (cdg1) ; le stockage aussi.
- Forfait Vercel Hobby : réservé à un usage non commercial. Pour un client payant, forfait Pro.

## Invérifiable depuis ici

- Exactitude actuelle des informations du site actuel (barème « au 10 avril 2024 », équipe, prix des annonces).
- Statut légal complet (carte T/G, garantie, assurance) : aucune source publique consultée ne les donne.
- Avis Google : seules les notes et le nombre d’avis ont pu être relus ; le détail des avis demande un compte Google.
- Droits d’usage des photos (annonces, équipe, visuels) : ce sont celles de l’agence, à faire confirmer avant mise en ligne réelle.
