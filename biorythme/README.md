# Biorythme — site + réservation des cours

Next.js 15 (App Router) · Tailwind v4 · Motion · Supabase (Postgres + Realtime) · déployé sur Vercel.

## Pages

- `/` accueil, `/clubs`, `/contact`
- `/planning` : planning des 2 clubs sur 14 jours, places restantes **en temps réel**. Réserver demande un compte (prénom, nom, email, mot de passe) ; les infos sont ensuite remplies automatiquement.
- `/compte` : espace membre — prochains cours et historique, annulation, modification du profil et du mot de passe, accessible depuis n'importe quel appareil.
- `/admin` : espace gérante (mot de passe `ADMIN_PASSWORD`) — planning par semaine, ajout de cours (avec répétition hebdo), copie d'une semaine sur la suivante, liste des inscrits, annulation/suppression, gestion des salles, types de cours et coachs, liste des membres avec mot de passe provisoire en cas d'oubli.

## Base de données

`supabase/schema.sql` est appliqué automatiquement avant chaque build (`scripts/migrate.mjs`) dès que `POSTGRES_URL_NON_POOLING` est présent. Il est idempotent.

- La réservation passe par la fonction `bio_book` (verrou sur la séance) : pas de surbooking possible, même avec des réservations simultanées, et une seule place par email et par cours.
- Le public ne peut lire que les séances publiées ; membres et réservations ne sont accessibles que côté serveur (clé service-role). La réservation (`bio_book_member`) n'est exécutable que par le serveur.
- Comptes membres dans `bio_members` (indépendants de l'auth Supabase, la base étant partagée) : mots de passe hachés en scrypt, session dans un cookie httpOnly signé (HMAC).
- Un planning de démonstration sur 14 jours est créé si la table des séances est vide.

## Variables d'environnement

Fournies par l'intégration Supabase de Vercel : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING`.
À définir : `ADMIN_PASSWORD`.

## Dev

```bash
npm install
npm run dev
```
