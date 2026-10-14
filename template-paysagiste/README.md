# Template — site de jardinier paysagiste

Site statique (HTML/CSS/JS, sans dépendance) qui se personnalise **par le lien**, sans redéployer.

## Envoyer des démos en série

1. Ouvrir `generateur.html` sur le site déployé.
2. **Étape 1** : écrire son message une fois, avec les variables `{nom}`, `{lien}`, `{ville}`, `{note}`, `{avis}`.
3. **Étape 2** : importer un fichier Excel (`.xlsx`, `.xls` ou `.csv`), une ligne par entreprise. Un modèle est téléchargeable dans la page. Les doublons sont ignorés et le 0 initial des numéros est restauré.
4. **Étape 3** : pour chaque prospect, « Copier le message » puis coller dans la conversation. Cocher « Envoyé » au fur et à mesure.

Le message, la liste et les cases « Envoyé » sont gardés dans le navigateur (`localStorage`) : utiliser toujours le même navigateur, et « Exporter en Excel » pour garder une copie (liens et messages inclus).

Exemple de lien :

```
https://VOTRE-SITE.vercel.app/?nom=Jardins+Dupont&ville=Hyères&cp=83400&tel=0612345678&note=4.8&avis=27
```

| Paramètre | Effet |
|---|---|
| `nom` | Nom de l'entreprise (logo, titres, pied de page) |
| `ville`, `cp`, `adresse` | Localisation, carte, itinéraire, météo en direct |
| `tel` | Boutons « Appeler » |
| `note`, `avis` | Note Google. Sans `avis`, la section avis est masquée |
| `email` | Si présent, le formulaire envoie réellement (FormSubmit.co) |
| `sans-bandeau` | Masque le bandeau « Aperçu personnalisé » |

Le bandeau peut afficher **vos** coordonnées : remplir `VENDEUR` en haut de `assets/js/personalize.js`.

## Limites à connaître

- **Photos et vidéo d'exemple** : la vidéo et les 3 images (`assets/img/exemple-*.jpg`) sont générées par IA, et toutes tirées de la même scène. Pour un vrai client, il faut les remplacer par ses photos de chantier.
- **Textes orientés Sud / Méditerranée** : calendrier des saisons, débroussaillage, sécheresse… À adapter pour un paysagiste du Nord.
- **Sans `email`, le formulaire n'envoie rien** : il affiche un écran de démo qui le dit clairement.
- Les pages sont en `noindex` : une démo ne doit pas apparaître sur Google sous le nom d'une entreprise qui n'a rien validé.
