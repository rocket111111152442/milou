# Lot Chromium isolé, performant et économique — audit et plan d'implémentation

Auteur : Claude 2 · 1er novembre 2026 · **Audit et plan uniquement : aucun code de production modifié, rien déployé.**
Référence : branche de développement `6e92875`/`337791a` ; travaux parallèles lus (non modifiés) : `codex/adaptive-reader-lot1` (`e9464ae`).
Légende : **[prouvé]** = constaté en exécutant le code actuel (`docs/chromium/probe-chromium.mts`) ; **[code]** = déduit de la lecture ; **[hypothèse]** = non vérifié.

## 1. Résumé

Le navigateur actuel est correctement **encadré côté Chromium** (contextes neufs, service workers/téléchargements bloqués, proxy de sortie qui valide DNS et IP à chaque connexion). Mais l'isolation est **déclarative, pas contraignante** : tout repose sur le fait que Chromium n'est pas compromis. Trois défauts sérieux sont **prouvés** et un quatrième structurel :

| # | Constat | Gravité | Preuve |
| --- | --- | --- | --- |
| C1 | Chromium tourne avec `--no-sandbox` (valeur par défaut de Playwright) | **Élevée** | [prouvé] ligne de commande du processus : `--headless --no-sandbox` |
| C2 | Les **secrets du worker** (`DATABASE_URL`, `WAVERTI_ENCRYPTION_KEY`, clés Resend/Brave…) sont **hérités par tous les processus Chromium** | **Élevée** | [prouvé] valeurs de test lisibles dans `/proc/<pid>/environ` de chaque processus Chromium |
| C3 | **Deux navigateurs et deux proxys** démarrent quand deux rendus arrivent en même temps au premier usage ; l'un est perdu (fuite de processus, arrêt du worker bloqué) | Moyenne | [prouvé] 2 processus navigateur principaux après 2 rendus concurrents ; la sonde ne se termine pas à l'arrêt |
| C4 | Le proxy de sortie n'est qu'un **réglage** de Chromium : un moteur compromis (C1) peut ouvrir directement des connexions (réseau interne, base de données, métadonnées), car navigateur, proxy et worker partagent le même utilisateur, le même réseau et les mêmes fichiers | **Élevée** | [code] `pool.ts`, `worker.Dockerfile` : un seul conteneur, `USER pwuser` |

Conséquence : une faille de rendu (fréquentes dans Chromium) donnerait accès aux secrets (C2) sans barrière de bac à sable (C1) et au réseau interne (C4). **C1 + C2 se corrigent vite** (indépendamment de l'architecture cible) ; C4 demande la séparation en conteneurs.

## 2. Architecture actuelle (lue dans le code)

```
worker (Node, secrets en env, DB, Resend, Brave)         [un seul conteneur, user pwuser]
 ├─ runPageCheck (runner.ts): cache → robots → politesse → safeFetch (HTTP) → [looksJsRendered → BrowserPool.render]
 ├─ business/scenarios.ts → BrowserPool.withPage (scénarios Business)
 └─ BrowserPool (browser/pool.ts)
     ├─ startEgressProxy() : http.Server 127.0.0.1:<aléatoire>  (browser/egress-proxy.ts)
     └─ chromium.launch({ proxy, args }) ──► 1 navigateur partagé, 1 contexte neuf par rendu, Semaphore(WORKER_BROWSER_CONCURRENCY=2)
```
Garde-fous existants (à conserver) : `parseTargetUrl` (ports 80/443/8080/8443, pas d'identifiants, suffixes `.local/.internal/...`), `isPublicAddress` (loopback, privé, link-local dont 169.254.169.254, CGNAT, ULA, NAT64/6to4/Teredo refusés), proxy qui **résout puis se connecte à l'IP validée** (pas de fenêtre de DNS rebinding), `--proxy-bypass-list=<-loopback>`, QUIC/WebRTC non proxifié/DoH désactivés, `serviceWorkers: "block"`, `acceptDownloads: false`, schémas non `http(s)/data/blob` refusés, méthodes non-GET limitées (`mutatingHosts`), images/médias/polices bloqués pour `render()`, plafond 20 Mo par connexion CONNECT, robots.txt + `HostPoliteness` (5 s par hôte) **avant** le rendu, cache SQL partagé, coût `playwright` enregistré (`cost.playwright_run_micros`, 2000 µ par défaut).

## 3. Lacunes détaillées

**Isolation / SSRF**
* C1–C4 ci-dessus. Le proxy n'a **aucune authentification** : tout processus local peut l'utiliser (la politique IP s'applique quand même). [code]
* Le plafond d'octets ne s'applique qu'aux tunnels CONNECT, **pas au HTTP en clair** ni au total d'un rendu. [code]
* Redirections : suivies par Chromium, chaque saut passe par le proxy (IP validée) ✔, mais **aucun contrôle robots.txt / politesse** sur l'hôte final d'une redirection inter-domaines, ni dans le chemin HTTP (`safeFetch`) ni dans le navigateur. [code]
* Les sous-requêtes (scripts, XHR, iframes) vers des tiers sont toutes autorisées : bande passante, traçage et surface d'attaque inutiles. [code]
* `window.open`/popups, WebSocket, `data:`/`blob:` volumineux : non bornés. [code]

**Ressources**
* Aucune limite **par rendu** : octets totaux, nombre de requêtes, mémoire de page, CPU. Seul le délai global (30 s) existe, via `Promise.race` qui **n'annule pas** le travail (le contexte est fermé ensuite) et dont le minuteur n'est pas effacé. [code]
* Limites seulement au niveau du conteneur entier (`cpus: 2`, `memory: 3g`, `shm_size: 1gb`) **partagées avec le worker** : un rendu gourmand peut faire tuer tout le worker (OOM). [code]
* Un navigateur unique et durable, sans recyclage (fuites de mémoire cumulées), sans gestion de l'événement `disconnected`/crash. [code]
* Mesure : 2 navigateurs (C3) ≈ **893 Mo de RSS cumulé** pour deux rendus d'une page triviale, ≈ 1,0–1,5 s à froid. [prouvé]

**Concurrence / files**
* `Semaphore` FIFO **sans limite de file ni délai d'attente** (le délai de 30 s ne démarre qu'après obtention du créneau) ; aucune priorité, équité par utilisateur ou par hôte ; **même pool** pour les pages (8 tâches concurrentes pour 2 navigateurs) et les scénarios Business : l'un peut affamer l'autre. [code]

**Attentes**
* `waitUntil: "domcontentloaded"` puis `networkidle` **fixe de 5 s, erreur avalée** : coût maximal sur les pages qui ne se stabilisent jamais (sondages, analytics), contenu parfois incomplet sur les pages lentes. Scénarios : `domcontentloaded` + attentes de 10 s fixes. [code]

**Coûts**
* Coût forfaitaire (2000 µ) par rendu quel que soit le temps, les octets ou la mémoire ; **pas de plafond global** (contrairement à Brave), pas de quota par formule, pas de coupe-circuit par hôte. En mode navigateur explicite, l'usage n'était pas enregistré avant le correctif de Codex 2. [code]

**Éviter Chromium**
* Heuristique actuelle `looksJsRendered` (texte < 600 car. + `#root/#app/#__next`) — remplacée par `needsBrowser` côté Codex 2. Pas de mémoire par hôte, pas de requête conditionnelle (ETag/If-Modified-Since). [code]

## 4. Architecture cible

### 4.1 Séparation en trois composants (modèle de menace : le moteur de rendu est hostile)
```
worker ──HTTP interne (jeton)──► renderer (conteneur)          ┌─ réseau interne « render-net » (internal: true, sans route Internet)
                                  Chromium + sandbox ON         │
                                  AUCUN secret, FS lecture seule│
                                  ──proxy (jeton par rendu)──► egress-proxy (conteneur) ──► Internet (IP publiques validées)
```
* **renderer** : image dédiée (Playwright + un petit serveur `POST /render`), utilisateur non privilégié, **`--no-sandbox` supprimé** (profil seccomp permettant les espaces de noms utilisateur, ou `chromiumSandbox: true` + `--cap-drop=ALL`), `read_only: true`, `tmpfs` bornés (`/tmp`, profil Chromium), `no-new-privileges`, `pids_limit`, `cpus`/`memory` propres, **aucune variable d'environnement sensible**, réseau `internal` : il ne peut joindre **que** l'egress-proxy. Un Chromium compromis ne voit ni la base, ni les secrets, ni Internet en direct.
* **egress-proxy** : le code actuel durci (`egress-proxy.ts`) dans son propre conteneur, seul à avoir une route Internet ; **authentification** par jeton à usage unique par rendu (`Proxy-Authorization`), plafond d'octets **par jeton** (budget du rendu) et par connexion, plafond du nombre de connexions, journal des blocages par motif, refus des en-têtes `Proxy-*`/`Connection` transmis, taille d'en-têtes bornée (anti-smuggling).
* **worker** : ne parle qu'au renderer via une API étroite (`RenderRequest` → `RenderResult`), jamais de Playwright exposé ; échec fermé (si le renderer est indisponible : `render_unavailable`, pas de repli sur un navigateur local).
* Variante mono-VPS sans Docker : unités systemd distinctes (`PrivateNetwork=`, `RestrictAddressFamilies=`, `IPAddressDeny=any` + `IPAddressAllow=<proxy>`, `NoNewPrivileges`, `MemoryMax`, `CPUQuota`, `TasksMax`, `SystemCallFilter=@system-service`).
* **Corrections rapides indépendantes** (lot 0, voir §7) : `env` minimal passé à `chromium.launch`, démarrage unique protégé par une promesse partagée (C3), minuteur effacé, file bornée avec délai, Chromium sans `--no-sandbox` si le noyau le permet.

### 4.2 Contrat worker ⇄ renderer
`RenderRequest { url, mode: "page"|"scenario", wait: WaitPlan, budget: RenderBudget, selector?, correlationId }` → `RenderResult { html, finalUrl, status, metrics: { totalMs, waitMs, requests, blocked: {reason: n}, bytes, peakRssMb, cpuMs }, reason: "ok"|"timeout"|"budget_bytes"|"budget_requests"|"navigation_denied"|"crash" }`. L'interface actuelle `BrowserRenderer.render(url,{timeoutMs}) → {html,finalUrl,status}` **reste valide** : les champs ajoutés sont optionnels (compatibilité avec `runner.ts` de Codex 2 sans le modifier).

### 4.3 Limites par rendu (`RenderBudget`, valeurs initiales à mesurer puis figer)
Durée totale 20 s (dont attente de contenu ≤ 8 s) ; octets reçus ≤ 8 Mo (≤ 2 Mo par ressource) ; requêtes ≤ 150 ; navigations de cadre principal ≤ 5 ; **un seul onglet** (tout `popup` fermé) ; WebSocket refusés sauf même origine ; `--js-flags=--max-old-space-size=256` ; surveillance du RSS du processus par un chien de garde (arrêt du contexte, puis du navigateur au-delà du seuil) ; contexte détruit à la fin ; navigateur **recyclé** après N rendus (≈ 50) ou T minutes ou RSS > seuil. Enforcement **double** : dans le renderer (route handler : comptage, types, tiers) et dans le proxy (octets par jeton).

### 4.4 SSRF et redirections (défense en profondeur)
1. Réseau : le renderer n'a **pas d'autre route** que le proxy (cf. 4.1).
2. Proxy : politique actuelle (résolution puis connexion à l'IP validée) + rejet des IPv6 littérales exotiques/zones, hôtes sans point, suffixes internes, ports non autorisés.
3. Renderer : refus des schémas `file:`, `ftp:`, `chrome:`, `view-source:`, `javascript:` ; `data:`/`blob:` bornés en taille ; navigation principale limitée à l'hôte initial + redirections **revalidées une à une** (événement `request.redirectedFrom`) avec **contrôle robots.txt et politesse sur chaque nouvel hôte de premier niveau**, et rejet du résultat si l'hôte final est interdit (`robots_disallowed`).
4. Sous-requêtes : liste « premier niveau + CDN reconnus » par défaut ; tiers inconnus bloqués (économie de bande passante et de CPU) ; liste configurable par hôte quand un site en dépend.
5. Résultat : taille de HTML plafonnée avant renvoi au worker ; le worker réextrait (Codex 2 : `readPageResponse`) et ne fait jamais confiance au renderer pour des décisions de sécurité.

### 4.5 Attentes adaptées au contenu (remplacent `networkidle` fixe)
`WaitPlan` = suite de conditions avec **sortie anticipée**, évaluées dans la page (`waitForFunction`) et bornées :
1. JSON-LD `Product/Offer` ou prix détecté (regex monétaire dans le texte visible) → terminé ;
2. sélecteur utilisateur (`cssSelector`) présent et non vide → terminé ;
3. **stabilité du DOM** : aucune mutation pendant 400 ms ET ≤ 1 requête en vol pendant 300 ms ET gain de texte ≥ seuil → terminé ;
4. plafond dur (8 s après `DOMContentLoaded`) → on rend ce qu'on a avec `reason: "partial"`, signalé au worker.
Pour les scénarios Business : attentes explicites par étape (sélecteur / URL / texte) au lieu de `domcontentloaded`+10 s fixes ; échec rapide si l'élément n'apparaît pas avant le budget de l'étape.

### 4.6 Concurrence et files
* Deux pools séparés avec créneaux réservés : **pages** (n−1) et **Business** (1 réservé), au lieu d'un pool commun.
* File **bornée** (taille et âge max) avec **admission** : si saturée, refus immédiat `render_busy` → le job est reprogrammé (pas d'attente active en mémoire).
* Priorités : aperçu demandé par l'utilisateur > Business > contrôle planifié > rattrapage ; équité : ≤ 1 rendu simultané par utilisateur et par hôte.
* Concurrence **adaptative** : cible CPU/RAM du conteneur renderer (ex. ≤ 70 %), pas un nombre fixe ; démarrage conservateur (2).
* Le worker ne **réserve** une tâche de type navigateur que si un créneau est disponible (évite de tenir un bail de job en attendant).

### 4.7 Éviter de lancer Chromium (échelle de décision, coût croissant)
1. cache SQL partagé (existant) → 2. **requête conditionnelle** (ETag/`If-Modified-Since` : 304 = aucun traitement) → 3. HTTP + extraction structurée (Codex 2) → 4. **état embarqué** : `__NEXT_DATA__`, `__NUXT__`, `application/ld+json`, `window.__INITIAL_STATE__` (sans exécuter de JS) → 5. navigateur **seulement si** : cible absente du HTML, coquille JS détectée par `needsBrowser`, **pas** de blocage/challenge/403/429/451 (jamais de contournement), robots.txt autorisé, budget et file disponibles.
* **Mémoire par hôte** (`render_hints`, TTL 7 j) : « HTTP suffit » / « navigateur requis » / « bloqué » ; hôte en échec répété → coupe-circuit à backoff exponentiel (24 h max). Décision produit à valider : fréquence minimale réduite des vérifications par navigateur par rapport au HTTP.

### 4.8 Coûts
* Coût **mesuré** par rendu : `micros = base + cpuMs × tarifCpu + Mo × tarifBande` (tarifs dans `app_settings`, valeurs initiales fondées sur le banc) enregistré dans `api_usage` avec durée, octets, requêtes (sans migration : utiliser `units`/`estimated_cost_micros` ; une migration optionnelle ajoutera des colonnes de métriques).
* **Plafond global mensuel** atomique « navigateur » (même mécanisme que `brave_api_global`) et **quota par formule** (décision produit : entitlement `monthly_browser_renders`) ; refus propre `render_budget_exhausted` ; coupe-circuit par hôte (4.7).
* Tableau de bord administrateur : rendus/jour, coût, taux de succès, motifs de blocage, taux de « navigateur inutile » (rendu dont le HTTP aurait suffi).

### 4.9 Robots.txt et limites d'accès (inchangés, étendus)
Robots + politesse **avant** le rendu (existant) **et** sur chaque hôte atteint par redirection de premier niveau (nouveau). Le navigateur ne sert **jamais** à franchir un 401/403/429/451, un CAPTCHA ou un challenge (`blocked` de Codex 2 prévaut). La politesse par hôte devient partagée entre workers (clé SQL ou Redis léger) — aujourd'hui locale au processus.

## 5. Fichiers concernés et dépendances avec Codex 2

| Fichier / zone | Changement prévu | Conflit avec Codex 2 |
| --- | --- | --- |
| `packages/monitoring/src/browser/pool.ts` | devient un **client** du renderer + file/priorités/budgets ; lot 0 : corrections C1–C3 | **Aucun** (non touché par Codex 2) |
| `packages/monitoring/src/browser/egress-proxy.ts` | auth par jeton, budgets par jeton, durcissement | Aucun |
| `packages/monitoring/src/browser/{index.ts}` + **nouveaux** `budget.ts`, `queue.ts`, `waits.ts`, `policy.ts`, `metrics.ts`, `service/` (serveur renderer) | nouveau code | Aucun |
| `packages/monitoring/src/business/scenarios.ts` | adapter `withPage`/attentes par étape | Aucun |
| `packages/monitoring/src/net/robots.ts`, `politeness.ts` | contrôle des hôtes de redirection, partage entre workers | Faible |
| **`packages/monitoring/src/runner.ts`** | passer `RenderRequest`/budget et recevoir `metrics` ; enregistrer le coût mesuré | **ÉLEVÉ : Codex 2 le réécrit** (`readPageResponse`, `needsBrowser`, `blocked`, usage enregistré avant tentative). **Attendre sa fusion**, partir de sa version. |
| `packages/monitoring/src/extract/response.ts` (Codex 2) | lecture seule : **source de vérité** de `needsBrowser` et `blocked` ; le nouveau moteur ne la modifie pas | À respecter |
| `apps/worker/src/{index.ts,config.ts,context.ts,jobs/pages.ts}` | nouvelles variables (`RENDERER_URL`, budgets), coût mesuré, réservation conditionnelle | Faible (vérifier `jobs/pages.ts`) |
| `infra/docker/*` (Dockerfile worker allégé, **renderer.Dockerfile**, **egress.Dockerfile**, compose, profil seccomp), `infra/deployment/*.service` | séparation des conteneurs, réseau interne, limites | Aucun |
| `docs/{COUTS,ENVIRONMENT,DEPLOYMENT}.md`, `app_settings` (clés de coût) | mises à jour | Aucun |
| Tests : `test/browser.int.test.ts`, `business.int.test.ts`, `business.load.test.ts`, nouveaux `browser-*.test.ts`, `bench/` | adaptation + nouveaux | `adaptive-runner.unit.test.ts` (Codex 2) doit rester vert |

**Contrat à geler avec Codex 2 avant de commencer** : (1) `BrowserRenderer.render(url,{timeoutMs}) → {html,finalUrl,status}` inchangé, champs ajoutés **optionnels** ; (2) la décision « navigateur nécessaire / bloqué » reste dans `response.ts` ; (3) `recordUsage` enregistre l'**intention** avant tentative (Codex 2) ; le coût **réel** est ajouté après (nouveau second appel) sans supprimer le premier ; (4) la clé de cache `adaptive-v1` ne change pas.

## 6. Plan de tests

**Sécurité (CI, conteneurs réels quand Docker disponible, sinon simulateurs)**
* Bac à sable actif : `--no-sandbox` **absent** ; processus rendus dans un espace de noms ; test de non-régression de la ligne de commande.
* Environnement : `/proc/<pid>/environ` de chaque processus du renderer **ne contient aucune** variable du worker (test du C2, adapté de la sonde).
* Réseau : depuis le renderer, connexion directe vers la base, `169.254.169.254`, `10.x`, Internet → **échec** ; seul le proxy répond.
* SSRF : matrice de redirections (302 vers IP privée, vers `localhost`, vers `*.internal`, IPv6 mappée, `0x7f.1`, DNS rebinding simulé avec résolveur à deux réponses, `meta refresh`, `Location` relative piégée), `file:`, `javascript:`, `data:` 50 Mo, WebSocket vers l'intérieur, `window.open`, `<a download>`, service worker, iframes en cascade.
* Robots : redirection inter-domaines vers un hôte interdit → résultat rejeté ; 403/429 → jamais de rendu.
* Smuggling : en-têtes `Proxy-*`, `Transfer-Encoding` ambigus, en-têtes géants vers le proxy.

**Ressources (banc de rendus hostiles)** : bombe CPU (boucle), bombe mémoire (allocation), page « jamais stable » (polling), ressource de 200 Mo, 5 000 requêtes, slow-loris, redirections infinies → chaque cas doit s'arrêter dans le budget, **sans affecter** les rendus concurrents ni le worker, et laisser **zéro** processus orphelin.

**Concurrence** : 50 demandes simultanées → file bornée, `render_busy` au-delà, priorité respectée, équité utilisateur/hôte, aucune fuite de contexte (compte des processus avant/après), arrêt propre en < 10 s même avec rendus en cours (corrige C3).

**Banc de performance reproductible** (`pnpm bench:browser`, serveur local de fixtures, aucune dépendance Internet, sortie JSON versionnée comme `docs/ADAPTIVE-BENCHMARK.json` de Codex 2) : fixtures = HTTP statique, coquille JS légère, coquille JS lourde, page « jamais stable », grosse page produits. Mesures : démarrage à froid/à chaud, p50/p95 de durée, **temps d'attente de file**, RSS maximal (somme des processus), CPU-ms (via `/proc`), octets, requêtes, taux de réussite, coût calculé ; concurrence 1/2/4 ; **comparaison avant/après** (ancien pool vs nouveau) sur la même machine ; **seuils CI** (ex. coquille légère p95 < 2,5 s, RSS < 450 Mo pour 2 rendus, 0 orphelin). Référence actuelle mesurée : 2 rendus triviaux concurrents ≈ 1,0–1,5 s à froid, ≈ 893 Mo cumulés (double navigateur, C3).

**Non-régression fonctionnelle** : `browser.int`, `business.int`, scénarios Business, `adaptive-runner.unit` (Codex 2), E2E web inchangés.

## 7. Phasage proposé (après fusion de Codex 2)

| Lot | Contenu | Taille | Risque | Dépend de |
| --- | --- | --- | --- | --- |
| **0 — Correctifs rapides** (peut commencer sans attendre Codex 2 : `pool.ts` n'est pas touché par lui) | C1 (sandbox si noyau compatible), C2 (`env` minimal), C3 (démarrage unique + arrêt propre), minuteur effacé, file bornée avec délai, `disconnected` géré | S | Faible | — |
| 1 — Budgets et proxy durci | `RenderBudget`, jetons de proxy, plafonds par rendu, popups/tiers | M | Moyen | 0 |
| 2 — Séparation renderer + proxy en conteneurs | images, réseau interne, API `/render`, seccomp, limites cgroup | L | Élevé (déploiement) | 1 |
| 3 — Attentes adaptatives et échelle « éviter Chromium » | `WaitPlan`, état embarqué, requêtes conditionnelles, `render_hints` | M | Moyen | **Codex 2 fusionné** |
| 4 — Coûts, quotas, tableau de bord | coût mesuré, plafond global, quota par formule | M | Moyen (produit) | 3, `runner.ts` Codex 2 |
| 5 — Banc et seuils CI | `bench:browser`, JSON de référence | S–M | Faible | transversal (dès le lot 0) |

## 8. Décisions à prendre (propriétaire)
1. Hébergement : Docker sur le VPS (recommandé) ou unités systemd ? Le noyau du VPS autorise-t-il les espaces de noms utilisateur non privilégiés (condition du bac à sable) ?
2. Quota de rendus par formule et plafond mensuel global (budget en €) — valeurs à fixer après le banc.
3. Sous-requêtes tierces bloquées par défaut (économie) : acceptable si certains sites perdent des éléments ?
4. Fréquence minimale des vérifications par navigateur plus lente que HTTP : oui/non.
5. Budget par rendu initial (§4.3) à valider après mesure.

## 9. Limites de cet audit
Exécuté sur l'environnement de développement (Chromium headless-shell 1243, Node 22, Linux) : le comportement du bac à sable dépend du noyau et des profils seccomp du VPS de production, **non audités** ; les valeurs de budget sont des points de départ, pas des mesures ; aucune faille de Chromium n'a été exploitée (C1/C2 sont des **conditions aggravantes** démontrées, pas une compromission) ; le worker de production et sa configuration réelle n'ont pas été vus (aucun accès).

## Annexe — sonde reproductible
`docs/chromium/probe-chromium.mts` (lecture seule, serveur local, aucun accès externe) : lance 2 rendus concurrents et affiche le nombre de processus navigateur, la présence de `--no-sandbox` et de variables secrètes factices dans l'environnement des processus Chromium. Exécution : `pnpm --filter @waverti/monitoring exec tsx docs/chromium/probe-chromium.mts` (arrêter ensuite les processus `chrome-headless-shell` restants : c'est précisément le défaut C3).
