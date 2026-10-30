# Rapport d'état — Watchly (29 octobre 2026)

**Watchly n'est pas terminé et n'est pas prêt pour un lancement commercial.** Le code des fonctions annoncées
existe et la plupart sont vérifiées par des tests automatisés sur des composants réels exécutés localement,
mais **aucun service de production n'est configuré** (Supabase, Stripe, Resend, Brave, serveur du worker,
domaine), les documents juridiques sont des modèles à compléter, et les installateurs Windows/macOS n'ont
jamais été construits.

## Niveaux utilisés

| Niveau | Signification précise |
| --- | --- |
| **Fonctionnel et vérifié** | Testé de bout en bout par des tests automatisés sur des composants **réels** exécutés localement ou en CI (Supabase Auth, PostgreSQL, Chromium, WebKitGTK, binaire Tauri). **Jamais en production, ni avec de vrais utilisateurs.** |
| **Fonctionnel en environnement de test** | Dépend d'un service externe payant **simulé** pendant les tests (stripe-mock, faux serveurs Resend/Brave, résolveur DNS injecté). Fonctionnement réel non constaté. |
| **Développé mais non vérifié** | Code écrit, jamais exécuté dans les conditions réelles visées. |
| **Non développé** | Absent. |

## 1. Fonctionnalités réellement terminées (fonctionnel et vérifié)

- Site public : page d'accueil (14 sections), tarifs, pages SEO, pages juridiques (modèles), robots/sitemap,
  responsive, accessibilité (axe : aucune violation critique ou grave), en-têtes de sécurité.
- Comptes : inscription avec e-mail de confirmation, connexion, mot de passe oublié, déconnexion, limitation
  des tentatives, messages anti-énumération, cookies de session httpOnly.
- **Double authentification TOTP** (ajoutée dans cette session) : activation par QR code, code exigé à la
  connexion, session sans code refusée (pages et API), désactivation avec code ; obligatoire pour
  l'administration avec `ADMIN_REQUIRE_MFA=1`.
- Surveillance de pages (moteur A) : extraction prix/stock/texte/modification, robots.txt, espacement par site,
  cache mutualisé, protection SSRF (IP vérifiée après DNS puis épinglée), file hybride ordinateur/serveurs.
- Quotas et droits appliqués côté serveur ; le navigateur et le desktop ne peuvent pas les modifier.
- Business (moteur C) : vérification de propriété (DNS/fichier), disponibilité à la minute avec confirmation,
  incidents, certificat HTTPS, scénarios navigateur limités au domaine vérifié (paiement/carte/mot de passe
  bloqués), rapports et export CSV, isolation entre clients.
- Administration LULLIN WEB : indicateurs, anomalies (dont erreurs récentes du worker), recherche et
  suspension motivée, journal d'audit, assistance, coûts ; invisible (404) pour les non-administrateurs.
- Historique global des contrôles (web et application desktop, ajouté dans cette session).
- Application desktop **Linux** : liaison par code, accord explicite obligatoire, contrôles locaux, alertes de
  bureau, pause, historique, déliaison — vérifiée sur le binaire Tauri réel piloté par WebDriver.
- Worker : image Docker construite et démarrée contre la base locale (signal de vie, arrêt propre).
- RGPD : export JSON des données, suppression du compte.

## 2. Fonctionnalités encore incomplètes

| Fonction | Niveau | Ce qui manque |
| --- | --- | --- |
| Abonnements, essai 72 h avec carte, portail, résiliation, webhooks | Fonctionnel en environnement de test | Compte Stripe, produits/prix test, webhook réel ; paiements réels interdits sans validation juridique |
| E-mails (alertes, assistance, rappels d'essai) | Fonctionnel en environnement de test | Compte Resend, domaine d'envoi vérifié (SPF/DKIM/DMARC) |
| Recherche sur Internet (moteur B) | Fonctionnel en environnement de test | Clé Brave Search payante ; qualité des résultats jamais mesurée sur de vraies requêtes |
| Vérification DNS Business | Fonctionnel en environnement de test | Jamais testée sur un vrai domaine |
| Desktop Windows / macOS | Développé mais non vérifié | Workflow de construction prêt, jamais exécuté ; aucun test manuel |
| Mises à jour automatiques signées du desktop | Développé mais non vérifié | Paire de clés de signature à générer |
| Connexion Google | Développé mais non vérifié | Désactivée ; identifiants OAuth Google non configurés |
| Documents juridiques | Modèles | Informations réelles (SIRET, adresse, hébergeurs, contact) et validation par un juriste |
| Rendu JavaScript des pages sur l'ordinateur | Non développé | Ces pages passent par les serveurs (formules avec relais cloud) |
| Proxy système d'entreprise (desktop) | Non développé | — |
| Codes de secours de la double authentification | Non développé | En cas de perte du téléphone : suppression manuelle du facteur dans Supabase |
| Rapports Business mensuels envoyés par e-mail, page de statut publique | Non développé | — |
| Application mobile, notifications push mobiles | Non développé | — |

## 3. Technologies utilisées

Monorepo pnpm 10 + Turborepo, TypeScript 6 strict. Web : Next.js 16 (App Router), React, Tailwind CSS v4,
Radix UI. Données : PostgreSQL (Supabase) avec RLS, Drizzle, migrations SQL. Authentification : Supabase Auth
(SSR, cookies httpOnly, TOTP). Paiement : Stripe (Checkout, portail, webhooks signés), mode test uniquement.
E-mails : Resend. Recherche : Brave Search API. Contrôles : fetch durci (SSRF), Playwright/Chromium.
Desktop : Tauri v2 (Rust : reqwest/rustls, trousseau du système, zone de notification) + React/Vite.
Worker : Node 22, Docker/systemd. Tests : Vitest, Playwright, tauri-driver + WebKitWebDriver, cargo test.
CI : GitHub Actions. Hébergement web : Vercel (projet distinct « watchly »).

## 4. Tests exécutés et résultats (derniers passages)

| Suite | Résultat | Environnement |
| --- | --- | --- |
| Unitaires + intégration (`pnpm test`) | **211/211** (15 fichiers) | PostgreSQL, Chromium, stripe-mock locaux |
| E2E site web (`pnpm test:e2e`) | **34/34** (dont double authentification, `ADMIN_REQUIRE_MFA=1`) | Supabase local, Mailpit, stripe-mock |
| E2E desktop réel (WebDriver) | **5/5** | Binaire Tauri debug, WebKitGTK, Xvfb |
| Rust (`cargo test` + clippy) | **12/12** | — |
| Charge (`pnpm test:load`) | **3/3** — voir `docs/LOAD-TEST-RESULTS.md` | Machine de test uniquement |
| Typage + lint du monorepo | OK | — |

CI GitHub : les tests unitaires/intégration, l'E2E web et les tests Rust sont passés sur les commits
précédents. L'E2E desktop vient d'être ajouté à la CI : son premier passage a validé les 5 tests mais a échoué
au nettoyage (course avec le cache Mesa), corrigé depuis. Résultat de la CI pour le dernier commit : voir l'onglet Actions.

## 5. Vulnérabilités ou risques encore ouverts

- Aucun audit de sécurité externe ni test d'intrusion.
- CSP : `script-src 'unsafe-inline'` (scripts d'hydratation de Next.js).
- Pages privées rendues en streaming : statut HTTP 200 avec l'écran « introuvable » au lieu d'un vrai 404.
- Desktop : durcissement `freezePrototype` désactivé (incompatible avec une bibliothèque de l'interface).
- Installateurs non signés (avertissements Windows SmartScreen / macOS Gatekeeper).
- Double authentification sans codes de secours.
- Budget API : le plafond par défaut (`budget.monthly_api_eur` = 50 €) suspend les recherches non
  prioritaires au-delà d'environ 10 000 appels Brave par mois. À relever avec la croissance.
- Marge Pro : un abonné Pro utilisant tout son quota (1 000 recherches par mois) coûte environ 5 $ d'API
  Brave, pour 12,49 € HT de revenu (avant frais Stripe). Le prix ou le quota est à revoir.
- Sauvegardes de base non testées (aucune base de production).
- Incident de cette mission : lors d'une session précédente, l'adresse e-mail de l'utilisateur a été envoyée
  une fois dans l'en-tête User-Agent d'une requête vers crates.io. Ce n'est pas présent dans le code et ne
  s'est pas reproduit, mais c'est une fuite vers un service tiers qu'il faut connaître.

## 6. Services externes configurés

- **Vercel** : projet distinct `watchly` (aucun autre projet modifié), protection Vercel Authentication sur
  tous les déploiements, région cdg1. **Aucune variable d'environnement de service** : le site public fonctionne,
  l'espace client indique que l'authentification n'est pas configurée.
- **GitHub Actions** : CI du dossier `watchly/`, workflow manuel de construction desktop (jamais lancé).
- Aucun autre service : Supabase, Stripe, Resend, Brave, OVH et domaine **ne sont pas configurés**.

## 7. Services nécessitant une intervention humaine

Supabase (projet UE, migrations, modèles d'e-mails, SMTP), Vercel Pro (usage commercial) et variables
d'environnement, domaine et DNS, serveur du worker, compte Stripe (mode test puis validation juridique),
Resend (domaine), clé Brave Search, certificats de signature Windows et Apple, clé de mise à jour Tauri,
informations légales et validation juridique, attribution du rôle administrateur (`pnpm admin:grant`).
Procédure : `docs/DEPLOYMENT.md`.

## 8. URL Preview Vercel

Dernier déploiement (commit `1a19a33`, état READY, aucune erreur d'exécution) :
`https://watchly-lcar4k9pg-lullinismael2-9456s-projects.vercel.app`. Alias stable de la branche :
`https://watchly-git-claude-upbeat-r-81df6d-lullinismael2-9456s-projects.vercel.app`. Accès réservé au compte
Vercel (Vercel Authentication). Sans services configurés : pages publiques fonctionnelles, espace client
inaccessible (message explicite), `noindex`, bandeau « version de prévisualisation ».

## 9. URL Production

**Aucune.** Le premier déploiement d'un nouveau projet Vercel est automatiquement classé « production » : il a
été annulé avant la fin. Aucune mise en production n'a été faite : services non configurés, compte Vercel
Hobby (usage non commercial), paiements fictifs.

## 10. État des builds desktop

| Plateforme | État |
| --- | --- |
| Linux (.deb, AppImage) | Construits localement ; .deb installé et lancé ; E2E sur le binaire réel |
| Windows (.msi/.exe) | Non construit (workflow prêt, jamais exécuté) |
| macOS Intel / Apple Silicon (.dmg) | Non construit (workflow prêt, jamais exécuté) |
| Signature de code | Aucune (certificats absents) |
| Mises à jour automatiques | Désactivées (clé absente) |

La page Téléchargement ne propose aucun installateur tant qu'une version n'est pas enregistrée comme publiée.

## 11. Coûts mensuels estimés (à vérifier sur les grilles officielles)

| Poste | Estimation | Remarque |
| --- | --- | --- |
| Vercel Pro | ~20 $ / membre | Obligatoire pour un usage commercial |
| Supabase Pro | ~25 $ (+ calcul ; sauvegarde à un instant donné ≈ 100 $ en option) | |
| Serveur du worker (OVH VPS-1, 4 vCore / 8 Go) | ~5 à 8 € | Prix augmenté en avril 2026, montant exact non confirmé |
| Resend | 0 $ (≈ 3 000 e-mails/mois) puis ~20 $ | |
| Brave Search | ~5 $ / 1 000 requêtes (5 $ de crédit mensuel) | Principal coût variable : jusqu'à ~5 $ par abonné Pro actif |
| Stripe | Pas d'abonnement ; commission par paiement | |
| Domaine | ~1 € (10 à 20 € / an) | |
| Apple Developer | ~8 € (99 $ / an) | |
| Signature Windows | ~10 à 40 € | Selon la solution (certificat OV ou service de signature) |

Ordre de grandeur au lancement, hors volume Brave et hors sauvegarde PITR : **environ 70 à 130 € par mois**.

## 12. Actions nécessaires avant lancement commercial

1. Compléter et faire valider les documents juridiques (mentions légales, CGU/CGV, confidentialité, cookies),
   registre RGPD et contrats de sous-traitance.
2. Créer les services de production (Supabase, Vercel Pro, domaine, worker, Resend, Brave) et configurer les
   variables ; tester une restauration de sauvegarde.
3. Valider le parcours Stripe complet en mode test sur le vrai compte, puis activer les paiements réels
   seulement après validation juridique (`WATCHLY_ALLOW_LIVE_PAYMENTS`).
4. Activer `ADMIN_REQUIRE_MFA=1` et la double authentification des administrateurs.
5. Revoir le quota/prix Pro et le budget API au regard du coût Brave réel.
6. Construire, signer et tester manuellement les installateurs Windows et macOS.
7. Audit de sécurité externe.
8. Passer `NEXT_PUBLIC_LAUNCH_STATUS=live` seulement après tout ce qui précède.
