# Création des applications OAuth

Aucun secret ne doit transiter par une conversation : renseignez-les directement dans les variables d'environnement du serveur. La page **Connexions** de l'application affiche les URI exactes à déclarer et indique si chaque fournisseur est configuré.

Dans ce qui suit, `https://VOTRE-DOMAINE` est la valeur de `API_PUBLIC_URL` (l'URL publique du serveur). Les webhooks exigent HTTPS ; en local, la synchronisation périodique (10 min) prend le relais.

## Google (Gmail + Google Agenda)

1. [Google Cloud Console](https://console.cloud.google.com/) → créer un projet.
2. **APIs et services → Bibliothèque** : activer **Gmail API** et **Google Calendar API** (et **Cloud Pub/Sub API** pour les notifications Gmail).
3. **Écran de consentement OAuth** (Google Auth Platform) : type « Externe » (ou « Interne » pour un domaine Workspace), nom de l'application, e-mail d'assistance, domaine autorisé. Ajouter les comptes de test tant que l'application n'est pas vérifiée.
4. **Accès aux données → scopes** à déclarer (Antonio les demande progressivement, selon les capacités choisies) :

   | Capacité | Scope |
   | --- | --- |
   | Lecture des messages | `https://www.googleapis.com/auth/gmail.readonly` |
   | Brouillons (et envoi : Google les accorde ensemble) | `https://www.googleapis.com/auth/gmail.compose` |
   | Envoi | `https://www.googleapis.com/auth/gmail.send` |
   | Classement, archivage, corbeille | `https://www.googleapis.com/auth/gmail.modify` |
   | Lecture de l'agenda | `https://www.googleapis.com/auth/calendar.readonly` |
   | Création et modification de rendez-vous | `https://www.googleapis.com/auth/calendar.events` |
   | Toujours | `openid`, `email` |

   La suppression définitive (`https://mail.google.com/`) n'est pas demandée.
5. **Identifiants → Créer un ID client OAuth** → « Application Web ».
   - URI de redirection autorisée : `https://VOTRE-DOMAINE/api/oauth/google/callback`
   - (local) `http://localhost:8787/api/oauth/google/callback`
6. Variables : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**Important** : les scopes Gmail sont classés « restreints ». En dessous de 100 utilisateurs (mode test), aucune vérification n'est requise ; au-delà, Google impose une vérification de l'application et une évaluation de sécurité annuelle (CASA) par un tiers. Prévoir ce délai avant une ouverture publique.

### Notifications Gmail (facultatif, recommandé en production)

1. Pub/Sub → créer un sujet, ex. `projects/MON-PROJET/topics/antonio-gmail`.
2. Donner au compte `gmail-api-push@system.gserviceaccount.com` le rôle **Pub/Sub Publisher** sur ce sujet.
3. Créer un abonnement **push** vers `https://VOTRE-DOMAINE/api/webhooks/google/pubsub`, avec **authentification activée** (compte de service de votre choix) et l'audience `https://VOTRE-DOMAINE/api/webhooks/google/pubsub`.
4. Variables : `GOOGLE_PUBSUB_TOPIC`, `GOOGLE_PUBSUB_AUDIENCE` (l'audience ci-dessus), `GOOGLE_PUBSUB_SERVICE_ACCOUNT` (l'adresse du compte de service de l'abonnement).

Antonio appelle `users.watch` à la connexion et le renouvelle avant expiration (Google exige au moins tous les 7 jours). Les notifications Google Agenda (`events.watch`) sont activées automatiquement si `API_PUBLIC_URL` est en HTTPS ; le domaine doit être vérifié dans la Search Console du projet.

## Microsoft (Outlook + Calendrier)

1. [Portail Azure / Microsoft Entra](https://entra.microsoft.com/) → **Inscriptions d'applications → Nouvelle inscription**.
   - Types de comptes : « Comptes dans un annuaire organisationnel et comptes Microsoft personnels » (`MICROSOFT_TENANT=common`), ou un seul locataire (`MICROSOFT_TENANT=<id du locataire>`).
   - URI de redirection (plateforme **Web**) : `https://VOTRE-DOMAINE/api/oauth/microsoft/callback` (et `http://localhost:8787/api/oauth/microsoft/callback` en local).
2. **Certificats et secrets → Nouveau secret client** → copier la valeur dans `MICROSOFT_CLIENT_SECRET`. Noter l'échéance : un secret expiré coupe toutes les connexions.
3. **Autorisations d'API → Microsoft Graph → Autorisations déléguées** :

   | Capacité | Autorisation |
   | --- | --- |
   | Toujours | `openid`, `email`, `offline_access`, `User.Read` |
   | Lecture des messages | `Mail.Read` |
   | Brouillons, classement, corbeille | `Mail.ReadWrite` |
   | Envoi | `Mail.Send` |
   | Lecture de l'agenda | `Calendars.Read` |
   | Rendez-vous | `Calendars.ReadWrite` |

   Certaines organisations exigent un consentement administrateur.
4. Variables : `MICROSOFT_CLIENT_ID` (ID d'application), `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT`.

Les abonnements Graph (`/subscriptions`) sont créés automatiquement si `API_PUBLIC_URL` est en HTTPS et renouvelés toutes les heures si l'expiration approche. Microsoft n'offre pas de révocation de jeton par l'application : à la déconnexion, Antonio supprime ses jetons et abonnements ; l'utilisateur peut retirer le consentement sur https://myaccount.microsoft.com (ou https://account.live.com/consent/Manage pour un compte personnel).

## OpenAI

`OPENAI_API_KEY` : clé de projet avec accès à `gpt-6-luna`, `gpt-live-1.1` et `gpt-transcribe`. Elle reste sur le serveur ; le navigateur n'en reçoit jamais.
