# Sécurité

Signalement d'une vulnérabilité : via le formulaire d'assistance (catégorie « Signalement d'abus ») ou
l'adresse de contact de LULLIN WEB. Ne joignez jamais de mot de passe ni de donnée bancaire.

## Principes

1. **Le serveur décide** : droits d'abonnement, quotas, rôles et suspensions sont calculés et appliqués côté
   serveur. Le navigateur et l'application desktop ne peuvent pas les modifier (vérifié par des tests E2E).
2. **Aucune donnée de carte** chez Watchly : Stripe Checkout et le portail client sont hébergés par Stripe.
3. **Secrets hors du code et du client** : clés API (Stripe, Resend, Brave, service Supabase) uniquement
   dans l'environnement serveur ; aucune n'est présente dans le bundle navigateur ni dans l'application desktop.
4. **Moindre privilège** : RLS PostgreSQL (lecture de ses propres lignes uniquement), écritures par le
   serveur après validation Zod ; l'administration répond 404 à tout non-administrateur.

## Contrôles en place

| Menace | Mesure | Vérification |
| --- | --- | --- |
| Accès aux données d'un autre client (IDOR) | RLS + filtrage par propriétaire dans chaque requête serveur ; 404 pour une ressource d'autrui | E2E `security.spec.ts`, `business.spec.ts`, tests RLS |
| CSRF | Écritures refusées si l'en-tête `Origin` ne correspond pas ; cookies Supabase `SameSite=Lax` | E2E |
| SSRF (serveur, desktop, navigateur automatisé) | Schémas http/https, ports 80/443/8080/8443, pas d'identifiants dans l'URL, noms internes refusés, **adresse IP vérifiée après résolution DNS puis épinglée**, redirections revalidées, taille et durée bornées ; proxy de sortie pour Chromium | 56 tests unitaires (TS), 12 tests Rust, E2E |
| Abus des essais gratuits | Un essai par e-mail normalisé et par carte (hachages HMAC poivrés) | Tests d'intégration webhooks |
| Force brute / spam | Limitation de débit en base : connexion (IP et compte), inscription, réinitialisation, liaison d'appareil, API | E2E |
| Énumération de comptes | Messages identiques pour adresse connue / inconnue | E2E |
| Webhooks falsifiés | Signature Stripe obligatoire, idempotence (verrou consultatif), relecture de l'abonnement chez Stripe | Tests d'intégration + E2E |
| Vol de mot de passe | Double authentification TOTP facultative (Paramètres), obligatoire pour l'administration avec `ADMIN_REQUIRE_MFA=1` ; tant que le code n'est pas saisi, la session n'ouvre ni l'espace client ni l'API (401) ; code exigé pour la désactiver | E2E `mfa.spec.ts`, `admin.spec.ts` (avec `ADMIN_REQUIRE_MFA=1`) |
| Vol de jeton d'appareil | Jeton stocké haché côté serveur, gardé par Rust (trousseau du système) côté client, révocable depuis le site ; un jeton n'ouvre ni l'administration ni la facturation | E2E desktop, E2E sécurité |
| Contrôles locaux abusifs | Agent limité aux tâches de SON utilisateur, accord explicite versionné et horodaté, robots.txt, 5 s entre deux requêtes vers un même site, aucune adresse locale | Tests unitaires de l'agent, E2E desktop |
| Scénarios Business dangereux | Domaine vérifié uniquement, POST hors domaine bloqués, clics « payer/commander/supprimer… » et champs carte/mot de passe bloqués | Tests d'intégration avec Chromium réel |
| Surveillance massive d'un site | Cadence minimale par formule, espacement par hôte, cache mutualisé, robots.txt (moteur A), budget API | Tests unitaires et de charge |
| Injection HTML (XSS) | Rendu React échappé, e-mails échappés, CSP | E2E (nom contenant `<script>`) |
| Injection de formules dans les exports CSV | Préfixe des cellules commençant par `= + - @` | Code des exports |
| Paiements réels involontaires | Clés `sk_live_` refusées sans `WATCHLY_ALLOW_LIVE_PAYMENTS=I_HAVE_LEGAL_APPROVAL` | Tests unitaires |

## En-têtes HTTP

CSP stricte (`default-src 'self'`, aucune ressource tierce, `frame-ancestors 'none'`, `form-action` limité à
Stripe), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS (Vercel).

**Limite assumée** : `script-src` autorise `'unsafe-inline'` car Next.js injecte des scripts d'hydratation ;
une CSP à nonce imposerait le rendu dynamique de toutes les pages publiques (perte du cache statique). Le
risque est réduit par l'absence de contenu HTML fourni par les utilisateurs et l'échappement systématique.

## Application desktop

- Commandes Tauri limitées : aucune commande de fichier ou d'ouverture de shell ; ouverture de liens limitée à
  http/https ; `fetch_robots` n'accepte que `/robots.txt`.
- CSP de la webview : aucun réseau direct depuis l'interface (tout passe par Rust).
- Le durcissement `freezePrototype` de Tauri est **désactivé** : il cassait une bibliothèque de l'interface
  (constaté en E2E). Compensation : CSP sans script externe et commandes restreintes côté Rust.
- Installateurs : non signés tant que les certificats Windows/Apple ne sont pas fournis ; le workflow de
  publication ne crée que des **brouillons** et l'indique dans la note de version.

## Points restant à traiter avant un lancement commercial

- Activer `ADMIN_REQUIRE_MFA=1` en production (les administrateurs sont alors invités à activer la double
  authentification avant d'accéder à l'administration). Pas de codes de secours : un administrateur qui perd son
  application d'authentification doit faire supprimer le facteur depuis le tableau de bord Supabase.
- Configurer les alertes de sécurité Supabase/Vercel et la rotation des clés.
- Audit externe recommandé (test d'intrusion) avant ouverture au public.
- Validation juridique (RGPD, CGV) — voir `docs/ROADMAP.md`.
