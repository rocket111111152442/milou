# Biorythme — site + réservation des cours

Next.js 15 (App Router) · Tailwind v4 · Motion · Supabase (Postgres + Realtime) · déployé sur Vercel.

## Pages

- `/` accueil, `/clubs`, `/contact`
- `/planning` : planning des 2 clubs sur 14 jours, places restantes **en temps réel**, réservation en 10 s (nom + email), « Mes réservations » pour annuler.
- `/admin` : espace gérante (mot de passe `ADMIN_PASSWORD`) — planning par semaine, ajout de cours (avec répétition hebdo), copie d'une semaine sur la suivante, liste des inscrits, annulation/suppression, gestion des salles, types de cours et coachs.

## Base de données

`supabase/schema.sql` est appliqué automatiquement avant chaque build (`scripts/migrate.mjs`) dès que `POSTGRES_URL_NON_POOLING` est présent. Il est idempotent.

- La réservation passe par la fonction `bio_book` (verrou sur la séance) : pas de surbooking possible, même avec des réservations simultanées, et une seule place par email et par cours.
- Le public ne peut lire que les séances publiées ; les réservations (données personnelles) ne sont lisibles que côté serveur avec la clé service-role.
- Un planning de démonstration sur 14 jours est créé si la table des séances est vide.

## Variables d'environnement

Fournies par l'intégration Supabase de Vercel : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING`.
À définir : `ADMIN_PASSWORD`.

## Dev

```bash
npm install
npm run dev
```
