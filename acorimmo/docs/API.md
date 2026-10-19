# API de synchronisation des annonces — statut : À CONNECTER

Cette API permet à un **logiciel de transaction externe** (ou à un script d'import) de publier,
mettre à jour et retirer des biens sur le site. Elle est **générique** : aucune intégration avec un
logiciel précis n'est implémentée, faute de documentation officielle fournie par l'agence.

Pour la brancher sur le logiciel réel de l'agence, il faudra :

1. obtenir la documentation officielle de son export (flux XML, API, FTP…) ;
2. écrire un petit connecteur qui lit cet export et appelle les routes ci-dessous ;
3. définir la variable `SYNC_API_KEY` dans Vercel.

Tant que `SYNC_API_KEY` n'est pas définie, toutes les routes répondent `503`.

## Authentification

En-tête `Authorization: Bearer <SYNC_API_KEY>` sur chaque requête.
La clé doit être longue et aléatoire (32 caractères ou plus), et ne doit jamais être mise dans le code.

## Routes

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/v1/biens` | Liste complète des biens (y compris masqués et champs internes) |
| `PUT` | `/api/v1/biens/{refExterne}` | Crée ou met à jour le bien portant cette référence externe |
| `DELETE` | `/api/v1/biens/{refExterne}` | Retire le bien |
| `PUT` | `/api/v1/photos/{empreinte}.webp` | Envoie une photo (corps = le fichier, JPEG/PNG/WebP, 4 Mo max) |

`{refExterne}` est l'identifiant du bien dans le logiciel source (80 caractères max).

### Corps d'un `PUT` (JSON)

Mêmes champs que dans l'admin. Seuls `titre` et `ville` sont obligatoires.

```json
{
  "titre": "Villa 5 pièces vue mer",
  "ville": "Sanary-sur-Mer",
  "cp": "83110",
  "adresse": "Adresse interne, jamais publiée",
  "transaction": "vente",
  "statut": "disponible",
  "publie": true,
  "type": "Villa",
  "prix": "895 000",
  "surface": "140", "terrain": "800", "pieces": "5", "chambres": "4", "sdb": "1", "sde": "2",
  "description": "…",
  "equipements": ["Vue mer", "Piscine"],
  "composition": [{ "niveau": "Rez-de-chaussée", "piece": "Salon", "surface": "40" }],
  "dpe": "C", "dpeKwh": "120", "ges": "B", "gesCo2": "12",
  "photos": ["/api/media/photos/xxxx.webp"],
  "honoraires": "Les honoraires sont à la charge du vendeur."
}
```

Valeurs admises :

- `transaction` : `vente` ou `location` ;
- `statut` : `disponible`, `sous-compromis`, `vendu` ou `loue` ;
- `type` : `Maison`, `Villa`, `Appartement`, `Terrain`, `Immeuble`, `Local commercial`, `Parking` ou `Autre`.

Les photos doivent être des fichiers déjà présents sur le site : le connecteur les envoie d'abord avec
`PUT /api/v1/photos/{empreinte}.{ext}`, où `{empreinte}` est le début (24 à 64 caractères hexadécimaux) du SHA-256
du fichier. Le serveur vérifie l'empreinte et le vrai format de l'image, puis répond `{ "url": "/api/media/photos/…" }`
à reprendre dans le champ `photos` du bien. Renvoyer le même fichier ne crée pas de doublon.
Exemple complet : `scripts/import/import-annonces.mjs`.

À la création, un champ `id` lisible (lettres, chiffres, tirets) peut être proposé ; il est utilisé s'il est libre.

### Réponses

- `201` : bien créé ;
- `200` : bien mis à jour ;
- `400` : données invalides (message en clair) ;
- `401` : clé absente ou erronée ;
- `503` : API non activée.

Les biens importés portent `source: "api"` et le badge « Importé » dans l'admin.
