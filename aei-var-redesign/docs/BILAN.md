# Bilan — état réel de la solution (19 octobre 2026)

## Ce qui est réellement fonctionnel (testé en production)

- **Connexion et comptes :**
  - comptes nominatifs avec 3 rôles ;
  - premier compte créé depuis les variables d'environnement ;
  - mot de passe provisoire obligatoirement changé (imposé par le serveur) ;
  - verrouillage après 5 échecs ;
  - déconnexion des autres sessions au changement de mot de passe ;
  - création, désactivation et réinitialisation des comptes par un administrateur.
- **Biens :**
  - ajout, modification, suppression, ordre d'affichage ;
  - jusqu'à 30 photos, redimensionnées automatiquement ;
  - adresse privée ;
  - statut (disponible, sous compromis, vendu, loué) ;
  - vente ou location ;
  - publié ou masqué ;
  - étiquettes ;
  - filtres par ville, prix, type, statut et publication.
- **Site public :**
  - recherche de l'accueil réellement filtrante ;
  - fiches détaillées ;
  - favoris ;
  - statistique « biens en ligne » calculée sur les vrais biens.
- **Demandes :**
  - réception des demandes de contact, d'achat, de location, de gestion, de visite, d'estimation (avec photos), de rendez-vous et d'alerte ;
  - validation côté navigateur et côté serveur ;
  - consentement enregistré ;
  - anti-robot ;
  - code de suivi remis au client ;
  - statuts, notes internes et historique ;
  - export CSV compatible Excel ;
  - suppression définitive (droit à l'effacement).
- **Espace client :**
  - favoris ;
  - suivi d'une demande (code + e-mail ou téléphone) ;
  - inscription aux alertes ;
  - demande de rendez-vous (dates passées et week-ends refusés).
- **Tableau de bord :**
  - biens publiés et masqués ;
  - demandes à traiter, demandes sur 30 jours, estimations ;
  - demandes par semaine, par type ;
  - biens par statut ;
  - dernières demandes.
- **Sauvegardes :**
  - sauvegarde quotidienne automatique, conservée 30 jours ;
  - téléchargement d'une sauvegarde complète ;
  - restauration des biens.
- **Sécurité :**
  - données clients dans un stockage privé ;
  - code serveur non exposé ;
  - en-têtes de sécurité (CSP, HSTS…) ;
  - polices hébergées sur le site ;
  - carte Google chargée uniquement sur accord.
- **Pages légales :**
  - mentions légales, confidentialité, cookies, barème des honoraires ;
  - générées depuis `config/agence.js`.

## Ce qui utilise encore des données de démonstration ou provisoires

- **Les 10 biens :**
  - repris du site actuel de l'agence (aei-var.com) le 13 octobre 2026 ;
  - ce sont de vraies annonces, mais figées à cette date : prix, statuts et disponibilités ont pu changer ;
  - seule la villa de Bandol a une fiche complète.
- **Textes et équipe de l'accueil :**
  - repris du site actuel ;
  - la note « 4,7/5 sur 73 avis » vient de PagesJaunes et ces avis datent de 2021.
- **Compte administrateur :** l'identifiant `admin@aei-cote-mer.fr` est provisoire. Créez des comptes nominatifs avec de vraies adresses e-mail.
- **Mentions légales, honoraires, confidentialité :** les informations inconnues sont surlignées « À compléter » (carte T, garant, assurance, médiateur, capital, TVA, barème).
- **Fichier de test résiduel :** une photo de test envoyée lors des essais reste dans le stockage (non rattachée à un bien, sans incidence).

## Ce qui nécessite un service externe (« à connecter »)

| Fonction | Service prévu | État | Pour l'activer |
|---|---|---|---|
| Accusés de réception, notification de l'agence, mot de passe oublié, envoi des alertes | Resend (API documentée) | Code prêt, **désactivé** | Compte Resend, domaine vérifié, puis `RESEND_API_KEY`, `EMAIL_FROM` et `NOTIFY_EMAIL` dans Vercel |
| Synchronisation avec le logiciel de transaction | Inconnu (dépend de l'agence) | API générique prête (`/api/v1`), **désactivée** | Documentation officielle du logiciel, écriture du connecteur, `SYNC_API_KEY` |
| Base de données (si fort volume) | PostgreSQL (ex. Neon via Vercel) | Non nécessaire au démarrage | Réécrire `lib/storage.js` au-delà de quelques milliers de demandes |

Sans e-mail configuré, le mot de passe oublié ne fonctionne pas par e-mail : un administrateur doit réinitialiser le mot de passe depuis « Utilisateurs ». Si le propriétaire perd le sien, il faut intervenir dans le stockage.

## À vérifier avant de vendre cette solution à une agence

1. **Légal :**
   - compléter toutes les mentions « À compléter » avec l'agence ;
   - afficher le vrai barème d'honoraires (obligatoire) ;
   - faire relire les pages légales par un professionnel du droit ;
   - signer un contrat de sous-traitance RGPD avec l'agence (vous hébergez ses données clients).
2. **Annonces :**
   - savoir quel logiciel l'agence utilise et s'il permet un export documenté ;
   - sans cela, l'agence devra saisir ses biens deux fois ;
   - attention aussi aux portails (SeLoger, Leboncoin…) qui sont alimentés par ce logiciel, pas par le site.
3. **E-mails :** activer Resend avec le domaine de l'agence, sinon aucune confirmation ne part et les alertes ne sont pas envoyées.
4. **Nom de domaine :** brancher le domaine de l'agence, puis retirer la balise `noindex` des pages publiques pour le référencement.
5. **Référencement (SEO) :**
   - les fiches de biens sont construites dans le navigateur, ce que Google indexe moins bien que des pages générées côté serveur ;
   - à prévoir pour un site qui doit bien se positionner.
6. **Sécurité :**
   - créer des comptes nominatifs et supprimer le compte provisoire ;
   - changer les mots de passe communiqués par écrit ;
   - activer l'authentification à deux facteurs du compte Vercel ;
   - supprimer l'ancien store public et la variable `BLOB_OLD_PUBLIC_READ_WRITE_TOKEN` une fois la migration validée.
7. **Volume :** la solution actuelle (stockage fichiers) convient à une agence de taille normale. Au-delà de quelques milliers de demandes, passer à une base de données.
8. **Forfait Vercel :** le forfait gratuit (Hobby) est réservé à un usage non commercial. Pour un client payant, il faut le forfait Pro.
9. **Maintenance :** prévoir qui corrige les problèmes, met à jour les dépendances et répond à l'agence (contrat de maintenance).
