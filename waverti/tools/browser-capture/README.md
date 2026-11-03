# Relevé ponctuel Amazon.fr pour Waverti

1. Dans Chrome, ouvre `chrome://extensions`, active le mode développeur, puis choisis **Charger l’extension non empaquetée**. Sélectionne ce dossier `browser-capture`.
2. Connecte-toi à Waverti dans ce navigateur. Ouvre une fiche produit Amazon.fr, choisis la variante et attends que l’offre s’affiche.
3. Ouvre l’extension **Waverti — Relevé Amazon.fr**, puis clique sur **Relever et ouvrir Waverti**. Vérifie les données proposées dans l’assistant.

Le relevé est ponctuel. Il porte sur le prix en euros du bloc d’achat et la disponibilité affichés lors du clic. Une valeur manquante ou ambiguë reste inconnue. L’extension ne crée ni surveillance ni alerte.

Les permissions `activeTab` et `scripting` permettent la lecture de l’onglet actif au clic. L’extension transmet uniquement l’adresse canonique de la fiche, les données du relevé et son horodatage dans le fragment de l’URL Waverti. Le fragment reste côté navigateur et n’est pas envoyé dans la requête HTTP. L’extension ne conserve aucune donnée et ne transmet ni HTML, ni titre, ni cookie.
