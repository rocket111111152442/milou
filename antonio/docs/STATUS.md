# État exact des fonctions

## Opérationnel et vérifié dans cet environnement

- Comptes, organisations, sessions, profil, onboarding conversationnel avec récapitulatif modifiable, profils métier.
- Modèle d'actions durable (8 états), politique d'autorisation serveur, validations liées au contenu, modification invalidant la validation, idempotence, réservation atomique, résultats incertains et vérification, reprise des actions interrompues.
- Règles proposées → confirmées, exceptions, limites quotidiennes ; modèles approuvés ; autonomie par catégorie (initialement « préparation avec validation »).
- Traitement des messages : classement expliqué et corrigeable, extraction des demandes et échéances avec leur certitude, signalement des instructions adressées à un assistant.
- Point quotidien (planifié par le serveur et à la demande) ; dossiers en attente de réponse.
- Mémoire durable consultable/modifiable/supprimable ; transcriptions à conservation réglable ; export et suppression du compte.
- Consommation par poste, budgets utilisateur/organisation, alertes, mode dégradé sans IA, limites de boucle et d'actions.
- Interface complète (ordinateur et mobile), mises à jour temps réel, réduction des animations respectée.
- Tout cela avec le **compte de démonstration** et le **moteur de commandes sans IA**.

## Simulé (et signalé comme tel)

- Compte de démonstration : messages, agenda et envois fictifs (domaines `.example`), badge « Démo » et bandeau permanent.
- Moteur sans IA : compréhension par motifs d'un ensemble limité de phrases ; utilisé sans clé OpenAI, quand le budget est atteint ou si le service IA est indisponible.

## Écrit, testé contre des réponses simulées, en attente d'une configuration externe

| Fonction | Ce qu'il faut fournir |
| --- | --- |
| Gmail + Google Agenda (OAuth progressif, synchronisation incrémentale, envoi, brouillons, libellés, corbeille, rendez-vous + Meet) | Application OAuth Google (`GOOGLE_CLIENT_ID/SECRET`), voir OAUTH.md |
| Notifications Gmail en temps réel | Sujet et abonnement Pub/Sub (`GOOGLE_PUBSUB_*`) |
| Notifications Google Agenda, Microsoft Graph | `API_PUBLIC_URL` en HTTPS (domaine vérifié pour Google) |
| Outlook + Calendrier Microsoft (delta, envoi via brouillon, catégories, éléments supprimés, rendez-vous + Teams) | Inscription d'application Entra (`MICROSOFT_*`) |
| Assistant `gpt-6-luna` (API Responses, outils) | `OPENAI_API_KEY` |
| Voix GPT-Live, délégation, dictée `gpt-transcribe` | `OPENAI_API_KEY`, navigateur avec micro, HTTPS |
| Veille par le prénom | Chrome récent avec reconnaissance locale du français (installable depuis l'interface) |
| Déploiement Docker / Render | Démon Docker / compte Render (fichiers fournis, non exécutés ici) |

## Prévu, non développé (annoncé comme tel dans l'interface)

- Connecteurs CRM, outils de tâches, espaces documentaires (catégories présentes dans l'autonomie mais sans connecteur ; export CSV des tâches à la place).
- Calendriers secondaires, événements récurrents en création (lus et affichés, pas créés), réservation automatique d'un créneau sans validation.
- Suppression définitive (volontairement non activée : seule la corbeille est utilisée).
- Fermeture forcée d'une session vocale côté serveur (sideband) ; application de bureau pour une écoute système.
- Réponses écrites en flux progressif (la voix, elle, est progressive).

## Limites connues

- **Qualité de l'assistant avec `gpt-6-luna` non mesurée** : aucun appel réel n'a été possible.
- Intégrations Google/Microsoft jamais exécutées contre les vrais services : des écarts de détail avec les API restent possibles (ex. filtre `receivedDateTime` du delta Graph, conservation du `Message-ID` par Gmail utilisée pour la vérification des envois incertains).
- Scopes Gmail restreints : vérification Google et audit de sécurité obligatoires au-delà de 100 utilisateurs.
- Classement et extraction déterministes (règles explicables) : moins fins qu'un modèle, mais sans coût ni hallucination ; l'affinage par le modèle n'est pas branché.
- La durée vocale facturée est remontée par le navigateur.
- Les vues agenda affichent l'heure dans le fuseau du navigateur ; les calculs (créneaux, horaires, briefing) utilisent le fuseau du profil.
- `npm install` nécessite `legacy-peer-deps` (fichier `.npmrc` fourni) à cause d'un conflit de dépendances pair de l'outillage ; `@opentelemetry/api` est installé explicitement pour pg-boss.

## Gain de temps : pas de chiffre affiché

Aucune promesse chiffrée n'est affichée dans l'application. Pour en établir une, mesurer sur 2 à 4 semaines avec des utilisateurs réels :

1. Référence sans Antonio : temps passé sur des scénarios types (tri du matin, réponse à une demande d'information, organisation d'un rendez-vous à 2 participants, relances) — chronométré sur 10 occurrences par scénario.
2. Avec Antonio : même mesure, en comptant le temps de relecture et de validation.
3. Données disponibles dans l'application pour recouper : actions réussies par origine (règle / demande / geste), validations, refus et modifications (taux de correction), échecs.
4. Publier un gain uniquement par scénario, avec l'écart observé et la taille de l'échantillon.
