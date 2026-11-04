# Relevé navigateur pour Waverti

1. Télécharge et décompresse l’archive. Dans Chrome, ouvre `chrome://extensions`, active le mode développeur, puis choisis **Charger l’extension non empaquetée**. Sélectionne le dossier extrait qui contient `manifest.json`.
2. Connecte-toi à Waverti dans ce navigateur. Ouvre la page à surveiller.
3. Ouvre **Waverti — Relevé navigateur**. Clique sur **Utiliser l’onglet actif** ou colle une adresse et clique sur **Ouvrir Waverti avec cette adresse**. Vérifie le relevé proposé dans l’assistant.

Sur une fiche Amazon.fr, l’extension relève le prix visible du bloc d’achat et le stock affiché. Pour les autres sites, elle lit les données structurées d’une fiche produit si elles concordent. Les valeurs absentes ou ambiguës restent inconnues. Coller une adresse ne charge pas la page et n’effectue aucun relevé.

Le relevé ponctuel utilise `activeTab` et `scripting` sur l’onglet ouvert, au clic. Il transmet l’adresse, les éventuels prix et stock et l’horodatage dans le fragment de l’URL Waverti. Le fragment reste côté navigateur et n’est pas envoyé dans la requête HTTP. Utilise une adresse publique, sans identifiant, mot de passe ni lien privé.

## Contrôles récurrents de prix ou de stock

1. Ouvre le menu de l’extension et sélectionne **Relier ce navigateur**. Note le code affiché, puis sélectionne **Ouvrir la validation dans Waverti**. Compare les codes avant d’approuver la liaison.
2. Rouvre le menu, sélectionne **J’ai approuvé la liaison**, puis **Accepter et activer les contrôles**.
3. Sur la page HTTPS publique à surveiller, sélectionne **Autoriser cette page et ouvrir Waverti**. Accorde l’accès au site lorsque Chrome le demande, puis confirme la création de la surveillance dans Waverti.

Chrome doit rester ouvert. Chaque minute, l’extension demande à Waverti s’il existe un contrôle prévu pour une page autorisée. Elle ouvre cette page dans un onglet inactif, vérifie l’adresse chargée, puis ferme l’onglet. Un refus du site, une demande de connexion, un CAPTCHA ou une redirection vers une autre page empêche le relevé.

L’extension transmet les résultats au seul serveur Waverti. Elle enregistre le jeton de liaison, l’état d’activation et les empreintes des adresses autorisées. Elle ne lit ni n’enregistre tes cookies. Chrome peut utiliser la session du site déjà ouverte. Tu peux suspendre les contrôles, retirer l’accès à un site ou délier le navigateur dans le menu de l’extension.
