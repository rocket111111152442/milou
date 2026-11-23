# Déploiement

## Prérequis

- Un hébergement capable d'exécuter un **processus Node permanent** (SSE, webhooks, worker). Un hébergement purement serverless (Vercel Functions seules) ne suffit pas.
- PostgreSQL ≥ 14 (Neon, Supabase, Render, RDS…).
- Un nom de domaine en **HTTPS** pour les webhooks Google/Microsoft et la voix (micro et WebRTC exigent un contexte sécurisé).

## Variables d'environnement

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | oui | Connexion PostgreSQL |
| `APP_ENCRYPTION_KEY` | oui en production | 32 octets en base64 (`openssl rand -base64 32`) ; chiffre les jetons OAuth. **La changer rend les connexions existantes illisibles** |
| `APP_BASE_URL` | oui | URL de l'interface (cookies, redirections, contrôle d'origine) |
| `API_PUBLIC_URL` | oui | URL publique de l'API (callbacks OAuth, webhooks). Identique à `APP_BASE_URL` si un seul service sert les deux |
| `NODE_ENV` | oui | `production` (cookies `Secure`) |
| `RUN_WORKER_IN_WEB` | non | `true` pour un déploiement mono-instance |
| `OPENAI_API_KEY` | non | Active `gpt-6-luna`, la voix et la dictée |
| `OPENAI_TEXT_MODEL`, `OPENAI_LIVE_MODEL`, `OPENAI_TEXT_REASONING` | non | Défauts : `gpt-6-luna`, `gpt-live-1.1`, `low` |
| `PRICE_*` | non | Tarifs utilisés pour l'estimation des coûts (USD) |
| `GOOGLE_*`, `MICROSOFT_*` | non | Voir [OAUTH.md](OAUTH.md) |
| `TEST_RECIPIENT_ALLOWLIST` | non | Liste d'adresses : tout envoi réel vers une autre adresse est refusé (comptes de test) |

## Docker (une image, deux commandes)

```bash
docker build -t antonio ./antonio
```

```bash
docker run --env-file antonio/.env -p 8787:8787 antonio
```

```bash
docker run --env-file antonio/.env antonio node dist/worker.js
```

Les migrations sont appliquées au démarrage du web et du worker (verrou de Drizzle). Pour les lancer à part : `node dist/migrate-cli.js`.

L'image n'a pas pu être construite dans l'environnement de développement (pas de démon Docker) ; le build Node équivalent (`npm run build`, puis `node server/dist/index.js`) a été vérifié.

## Render

`antonio/render.yaml` décrit le service web, le worker et la base. Dans Render : **New → Blueprint**, choisir ce fichier (le `render.yaml` de la racine concerne Milou), puis renseigner les secrets du groupe `antonio-secrets`. Non testé faute d'accès Render.

## Mise à l'échelle

- Web : plusieurs instances possibles (sessions en base, SSE relayé par `NOTIFY`).
- Worker : plusieurs instances possibles. L'exécution d'une action est réservée atomiquement ; la synchronisation d'un compte est protégée par un verrou consultatif PostgreSQL ; les traitements de messages sont idempotents.

## Exploitation

- `GET /api/health` pour la supervision.
- Renouveler le secret client Microsoft avant son échéance.
- Sauvegardes de la base : elles contiennent des jetons chiffrés ; conserver `APP_ENCRYPTION_KEY` séparément.
- Journaux JSON (pino) sans en-têtes `Authorization`/`Cookie`.
