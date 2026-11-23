# Antonio — assistant de travail IA

Application web qui permet de déléguer des tâches quotidiennes (messagerie, agenda, suivis) à un assistant que l'on prénomme soi-même. L'assistant lit les outils connectés, prépare des décisions, exécute les actions autorisées et rend compte de ce qui a **réellement** été fait.

> Ce dossier est indépendant de l'application Milou présente à la racine du dépôt.

## Démarrage local (≈ 5 minutes)

Prérequis : Node.js ≥ 22.6, PostgreSQL ≥ 14.

```bash
cd antonio
cp .env.example .env
```

```bash
openssl rand -base64 32   # coller le résultat dans APP_ENCRYPTION_KEY du fichier .env
```

```bash
createdb antonio_dev      # ou adapter DATABASE_URL dans .env
```

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run dev               # API sur :8787, interface sur http://localhost:5173
```

Créez un compte en cochant « Ajouter un compte de démonstration » : tout fonctionne sans aucun identifiant externe, avec des données **fictives** clairement signalées. Sans `OPENAI_API_KEY`, l'assistant comprend un ensemble limité de commandes (badge « Sans IA ») ; avec la clé, il utilise `gpt-6-luna`, et la voix devient disponible.

## Ce qui est livré

| Espace | Contenu |
| --- | --- |
| Configuration initiale | Questions une par une, adaptées au métier, réponses écrites ou dictées, récapitulatif modifiable avant activation |
| Assistant | Conversation écrite et vocale, panneau contextuel piloté par des événements structurés, états vocaux visibles, coupure immédiate du micro |
| Point du jour | Préparé à l'heure choisie par le serveur ; observé / fait / à valider / recommandé / erreurs ; sources cliquables ; période couverte |
| Boîte de réception, Agenda, Tâches | Données synchronisées, classement expliqué et corrigeable, créneaux, export CSV |
| Validations, Historique | Actions avec état durable, contrôles effectués, validation liée au contenu, historique des transitions |
| Règles, Modèles | Règles explicites confirmées avec périmètre et exemples ; modèles approuvés |
| Connexions | Capacités réellement accordées, dernière synchro, erreurs, ajout d'autorisations, révocation |
| Profil, Consommation | Préférences, autonomie par catégorie, mémoire modifiable, export/suppression des données, budgets |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — choix techniques, schéma de données, cycle de vie des actions, sécurité
- [docs/OAUTH.md](docs/OAUTH.md) — création des applications Google et Microsoft, paramètres exacts
- [docs/VOICE.md](docs/VOICE.md) — architecture vocale (GPT-Live + délégation), veille par le prénom, limites
- [docs/DEPLOY.md](docs/DEPLOY.md) — variables, Docker, Render, mise à l'échelle
- [docs/TESTS.md](docs/TESTS.md) — tests et résultats, correspondance avec les 18 critères d'acceptation
- [docs/STATUS.md](docs/STATUS.md) — **liste exacte** des fonctions opérationnelles, simulées ou dépendantes d'une configuration externe, et limites connues

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | API (rechargement auto) + interface Vite |
| `npm run build` | Interface (`web/dist`) + serveur (`server/dist`) |
| `npm start` / `npm run worker` | Serveur web / worker de tâches de fond (production) |
| `npm run db:generate` / `npm run db:migrate` | Générer / appliquer les migrations SQL |
| `npm test` | Tests serveur (base `antonio_test`) |
| `npm run typecheck` | Vérification TypeScript |

## Structure

```
antonio/
  shared/src/        types partagés (états d'action, événements d'interface…)
  server/src/
    actions/         modèle d'action, politique d'autorisation, exécuteur
    agent/           orchestrateur gpt-6-luna, outils, moteur sans IA
    connectors/      google/, microsoft/, demo/, service OAuth + synchro
    rules/ mail/     règles, analyse et lecture des messages
    briefing/ voice/ point quotidien, voix GPT-Live
    jobs/ realtime/  file pg-boss, SSE via LISTEN/NOTIFY
    routes/          API HTTP
  server/migrations/ migrations SQL versionnées
  web/src/           interface React
```
