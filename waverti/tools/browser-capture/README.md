# Relevé navigateur pour Waverti

1. Télécharge et décompresse l’archive. Dans Chrome, ouvre `chrome://extensions`, active le mode développeur, puis choisis **Charger l’extension non empaquetée**. Sélectionne le dossier extrait qui contient `manifest.json`.
2. Connecte-toi à Waverti dans ce navigateur. Ouvre la page à surveiller.
3. Ouvre **Waverti — Relevé navigateur**. Clique sur **Utiliser l’onglet actif** ou colle une adresse et clique sur **Ouvrir Waverti avec cette adresse**. Vérifie le relevé proposé dans l’assistant.

Sur une fiche Amazon.fr, l’extension relève le prix visible du bloc d’achat et le stock affiché. Pour les autres sites, elle lit les données structurées d’une fiche produit si elles concordent. Les valeurs absentes ou ambiguës restent inconnues. Coller une adresse ne charge pas la page et n’effectue aucun relevé.

L’extension utilise seulement `activeTab` et `scripting` sur l’onglet ouvert, au clic. Elle ne crée ni surveillance ni alerte et ne conserve aucune donnée. Elle transmet l’adresse, les éventuels prix et stock et l’horodatage dans le fragment de l’URL Waverti. Le fragment reste côté navigateur et n’est pas envoyé dans la requête HTTP. Utilise une adresse publique, sans identifiant, mot de passe ni lien privé.
