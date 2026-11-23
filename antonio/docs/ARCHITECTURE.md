# Architecture

## Environnement examiné

Le dépôt contenait une autre application (Milou : marketplace en Next.js + Firebase). Rien n'y était réutilisable pour Antonio (pas de base relationnelle, pas de file de tâches, pas de connecteurs). Antonio est donc une application séparée dans `antonio/`, sans modifier Milou ni son déploiement Vercel.

## Choix

| Besoin | Choix | Raison |
| --- | --- | --- |
| Interface | React 19 + Vite + TypeScript, TanStack Query, Motion | SPA rapide ; l'état affiché est toujours relu depuis le serveur |
| Serveur | Node 22 + Fastify 5 + TypeScript | Processus long nécessaire (SSE, webhooks, worker) — incompatible avec du pur serverless |
| Base | PostgreSQL + Drizzle ORM, migrations SQL versionnées | Transactions, contraintes d'unicité pour l'idempotence, JSONB |
| File persistante, tâches planifiées | pg-boss (dans PostgreSQL) | Une seule dépendance d'infrastructure ; reprise après redémarrage |
| Temps réel | SSE + `LISTEN/NOTIFY` | Le worker et le web peuvent être des processus séparés |
| Authentification | Sessions en base, cookie `httpOnly`, scrypt | Pas de jeton exposé au JavaScript ; révocation immédiate |
| Organisations | `organizations` + `memberships` (owner/admin/member) | Isolation et budgets par organisation |
| Modèle texte | `gpt-6-luna` via l'API Responses (`store: false`) | Demandé ; texte seulement (pas d'audio) |
| Voix | `gpt-live-1.1` en délégation « client » | Voir [VOICE.md](VOICE.md) |
| Dictée | `gpt-transcribe` | Onboarding et saisie à la voix sans session vocale continue |

Versions vérifiées le 23 novembre 2026 sur npm et dans la documentation OpenAI (modèles, GPT-Live, délégation, transcription), Google (synchronisation Gmail/Calendar) et la spécification W3C Web Speech (`processLocally`).

## Processus

```
navigateur ──HTTP/SSE──> web (Fastify) ──┐
     │  WebRTC audio                     ├── PostgreSQL (données, file pg-boss, NOTIFY)
     └──────> OpenAI GPT-Live            │
                                          └── worker : synchronisations, règles, exécution
fournisseurs ──webhooks──> web             et vérification des actions, point quotidien,
                                           renouvellement des abonnements
```

`RUN_WORKER_IN_WEB=true` regroupe tout dans un seul processus (petit déploiement).

## Séparation des mémoires

| Nature | Stockage | Règle |
| --- | --- | --- |
| Conversation en cours | `conversations`, `turns` | Conservation réglable (`transcriptRetentionDays`), effaçable |
| Préférences durables | `memories` | Proposées puis confirmées ; consultables, modifiables, supprimables |
| Règles d'automatisation | `rules` | `proposed` → confirmées explicitement → `active` / `paused` |
| Données des outils | `messages` (métadonnées + extrait), `events` | Le corps des e-mails est lu à la demande, pas stocké (sauf démo) |
| Historique des actions | `actions`, `action_events`, `approvals` | Durable, exportable |

## Cycle de vie d'une action

```
proposée ─► politique serveur ─┬─► autorisée ─► en cours ─┬─► réussie
                               │                          ├─► échouée
                               ├─► en attente ─(validation│
                               │   liée au contenu)       └─► incertaine ─► vérification ─► réussie / échouée
                               └─► refusée (capacité absente, niveau « consultation », liste de test…)
```

- **Idempotence** : `(user_id, idempotency_key)` unique. Règle : `rule:<id>:msg:<id>:<action>` ; chat : clé dérivée du tour. Une notification reçue trois fois produit une seule action.
- **Réservation atomique** : `UPDATE … SET status='executing' WHERE status='authorized'` ; deux workers ne peuvent pas exécuter la même action.
- **Validation** : liée à `params_hash` (SHA-256 du JSON canonique). Toute modification change l'empreinte et invalide la validation ; l'exécuteur revérifie l'empreinte.
- **Envois** : Antonio génère le `Message-ID`. Coupure pendant l'envoi ⇒ état `uncertain` ; on cherche le message dans les éléments envoyés (`rfc822msgid:` chez Gmail, `internetMessageId` chez Graph) avant toute décision. Jamais de renvoi automatique.
- **Rendez-vous** : identifiant d'événement déterministe (Google) ou `transactionId` (Graph) ⇒ nouvel essai sans doublon. Disponibilités relues chez le fournisseur juste avant la réservation.
- **Reprise** : une action restée `executing` > 10 min (worker arrêté) repasse en `authorized` (opérations idempotentes) ou `uncertain` (envois).
- **Retour en arrière** : seulement ce que le fournisseur permet (corbeille → restauration, tâche → suppression). Un e-mail envoyé est signalé comme irréversible.

## Politique d'autorisation

`server/src/actions/policy.ts` est une fonction pure testée. Le modèle n'y a aucune entrée : la décision repose sur des faits vérifiés côté serveur.

Contrôles : compte actif et appartenant à l'utilisateur, capacité accordée par le fournisseur, niveau d'autonomie de la catégorie, provenance des destinataires (fil, utilisateur, contacts, correspondants connus), liste de destinataires de test, exceptions du message déclencheur (montant, pièce jointe, juridique, copie, urgence, déjà répondu, instructions suspectes), règle active et confirmée revérifiée sur le message, modèle approuvé, conflits d'agenda, horaires, limites quotidiennes, doublon.

Exécution sans validation uniquement dans ces cas :
1. préparation sans effet pour des tiers (brouillon, tâche) ;
2. geste direct de l'utilisateur dans l'interface ;
3. règle confirmée + catégorie en exécution automatique + **tous** les contrôles au vert ;
4. classement réversible demandé à l'oral/écrit quand la catégorie « Classement » est en automatique.

## Contenus externes non fiables

- Le contenu d'un e-mail est transmis au modèle encadré comme « CONTENU EXTERNE NON FIABLE », avec un signal si des instructions destinées à un assistant sont détectées.
- La protection ne repose pas sur le modèle : un destinataire inconnu bloque l'exécution automatique ; une règle n'est jamais active sans confirmation ; `approve_action` et `confirm_rule` exigent que la **phrase réelle** de l'utilisateur (non fournie par le modèle) soit un consentement explicite, sur un élément présenté au tour précédent.

## Sécurité et isolation

- Toutes les requêtes filtrent par `user_id` **et** `org_id` ; les identifiants d'un autre compte renvoient 404.
- Jetons OAuth chiffrés AES-256-GCM (`APP_ENCRYPTION_KEY`) ; PKCE ; `state` à usage unique et expirant.
- Protection CSRF : cookie `SameSite=Lax` + contrôle de l'en-tête `Origin` sur les requêtes modifiantes.
- Journaux : en-têtes `Authorization`/`Cookie` masqués ; le journal d'audit masque toute clé ressemblant à un secret.
- Webhooks : jeton OIDC Pub/Sub vérifié (émetteur, audience, compte de service), jeton de canal Google comparé en temps constant, `clientState` Graph vérifié ; déduplication en base.
- Pièces jointes : non téléchargées ; seuls leurs noms sont affichés, l'accès passe par le fournisseur.
- Export (`/api/account/export`) sans secrets ; suppression du compte avec révocation préalable des connexions.

## Schéma de données

Voir `server/src/db/schema.ts` et `server/migrations/0000_init.sql`. Tables : `organizations`, `users`, `memberships`, `sessions`, `profiles`, `autonomy`, `memories`, `connections`, `oauth_states`, `webhook_receipts`, `messages`, `events`, `demo_mailbox`, `tasks`, `actions`, `action_events`, `approvals`, `rules`, `templates`, `conversations`, `turns`, `briefings`, `voice_sessions`, `usage_records`, `budgets`, `audit_events`.
