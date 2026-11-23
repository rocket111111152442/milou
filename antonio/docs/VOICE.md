# Voix

## Architectures examinées (documentation OpenAI consultée le 23/11/2026)

| Option | Fluidité | Contrôle métier | Retenue |
| --- | --- | --- | --- |
| Chaîne transcription → `gpt-6-luna` → synthèse | Latence élevée, interruptions difficiles | Total | Non |
| Realtime (`gpt-realtime-2.1`) avec outils dans la session vocale | Bonne | Les outils seraient appelés par le modèle vocal ; logique métier dupliquée | Non |
| **GPT-Live (`gpt-live-1.1`) + délégation « client »** | Full duplex : écoute pendant qu'il parle, interruptions naturelles | Toute action passe par notre serveur, avec `gpt-6-luna` et la même politique que l'écrit | **Oui** |

`gpt-6-luna` n'est pas un modèle audio (entrée texte/image, sortie texte) : il n'est jamais présenté comme le modèle vocal.

## Fonctionnement

1. Le navigateur crée une offre WebRTC ; le serveur la transmet à `POST /v1/live/sessions` avec la clé API (jamais exposée) et reçoit la réponse SDP. Configuration : voix choisie (`sillage`, `brise` ou `marin`), délégation `client`, veille côté OpenAI (`wake_policy: speech`, `idle_timeout_s: 20`, tarif réduit en pause), `store: false`, et les derniers échanges réinjectés pour reprendre le contexte.
2. GPT-Live gère l'oral. Quand il faut agir, il émet `session.delegation.created`. Le navigateur envoie la phrase transcrite à `POST /api/voice/delegate` ; le serveur exécute le tour (mêmes outils, même politique que l'écrit) et renvoie un texte vérifié, que le navigateur transmet par `session.commentary.append` — GPT-Live le reformule à voix haute.
3. Les panneaux se mettent à jour à partir des événements d'interface renvoyés par le serveur.
4. Interruption : GPT-Live est full duplex ; couper la parole n'annule pas une action déjà lancée (son état reste consultable).

Validation orale : « oui » n'est accepté que pour l'élément présenté juste avant, et le serveur vérifie lui-même la transcription de la phrase.

## États visibles

Microphone coupé · En veille · À l'écoute · En cours de traitement · En train de parler. Bouton de coupure immédiate (et touche Échap) : la piste micro est désactivée localement **et** `session.input_audio.mute` est envoyé.

## Appel par le prénom

- Détection **locale** avec la Web Speech API en mode `processLocally = true` (reconnaissance sur l'appareil, spécification W3C ; Chrome récent). Tout prénom fonctionne.
- Si le navigateur ne propose pas la reconnaissance locale du français, la veille est désactivée et expliquée. **Aucun repli** sur la reconnaissance en ligne : l'audio ambiant n'est jamais envoyé pour attendre le prénom.
- La disponibilité n'est interrogée qu'au moment où l'utilisateur active la veille ; l'installation du modèle local demande un geste de l'utilisateur.
- Après le prénom, la session GPT-Live s'ouvre ; si la phrase contenait déjà une demande (« Antonio, montre-moi mes rendez-vous »), elle est traitée immédiatement et la réponse est prononcée dès que la session est prête.
- Alternatives toujours disponibles : bouton micro, `Ctrl+Maj+Espace`.

Limites (non contournables dans une page web) :
- une page fermée n'écoute pas ;
- un onglet en arrière-plan, l'écran verrouillé ou la mise en veille de l'ordinateur suspendent la reconnaissance : l'état passe à « Microphone coupé » ;
- la lecture audio peut être bloquée tant que l'utilisateur n'a pas interagi avec la page.

**Non vérifié ici** : l'environnement de développement n'a ni micro ni Chrome avec le service de reconnaissance locale (l'appel `SpeechRecognition.available()` fait même planter Chromium sans interface). Le code suit la spécification mais doit être essayé sur un poste réel.

## Évolution : application de bureau

Une écoute permanente au niveau du système demande une application installée (Electron ou Tauri) avec un détecteur local (ex. Porcupine — mot personnalisé soumis à licence et à une clé, ou openWakeWord — modèles à entraîner pour un prénom, licences à vérifier). Cette application ouvrirait la même session GPT-Live et utiliserait la même API ; elle n'est pas livrée.

## Coûts et limites

- GPT-Live : facturé à la durée (0,05 $/min actif, 0,02 $/min en pause d'après la page tarifaire au 23/11/2026) ; 15 s facturées à l'ouverture d'une session WebRTC (déduites ensuite).
- Antonio enregistre la durée remontée par `session.usage.updated`, applique un maximum par session et par jour, ferme la session après 2 minutes sans activité, et refuse d'ouvrir une session si le budget est atteint.
- Limite honnête : la durée provient des événements reçus par le navigateur. Une fermeture forcée côté serveur nécessiterait une connexion « sideband » (`wss://api.openai.com/v1/live/sessions/{id}/attach`) — prévue, non implémentée.
- Les estimations d'un chatbot texte ne s'appliquent pas : une heure de voix active ≈ 3 $ hors modèle texte.
- Aucun enregistrement audio durable ; les transcriptions sont conservées selon le réglage du profil (30 jours par défaut, 0 possible).
