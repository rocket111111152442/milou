# Feuille de route

## Bloquant pour un lancement commercial (décisions et actions de LULLIN WEB)

1. Informations légales réelles et validation juridique des documents (modèles fournis avec des zones `[À COMPLÉTER]`).
2. Compte Stripe activé + passage en paiements réels (après validation) ; TVA et facturation.
3. Supabase de production, Vercel Pro, domaine, serveur du worker, Resend, Brave Search (coûts à valider).
4. Certificats de signature Windows / Apple et tests manuels des installateurs sur ces systèmes.
5. Audit de sécurité externe recommandé.

## Améliorations techniques identifiées

- Desktop : rendu des pages générées en JavaScript sur l'ordinateur (aujourd'hui, ces pages utilisent le
  navigateur des serveurs, donc une formule avec relais cloud) ; prise en charge du proxy système des
  entreprises ; tests E2E automatisés Windows/macOS dans la CI.
- Statut HTTP 404 réel (au lieu de 200 avec l'écran « introuvable ») pour les pages privées rendues en streaming.
- CSP à nonce pour supprimer `'unsafe-inline'`.
- Rapports Business envoyés automatiquement par e-mail chaque mois ; page de statut publique optionnelle.
- Notifications push mobiles ; application mobile.
- Recherche Web : fournisseurs supplémentaires et déduplication sémantique avancée.

## Hors périmètre volontaire

- Surveillance de « tout Internet » : Watchly surveille des pages et des sujets précis, via des sources
  publiques et une API de recherche, dans le respect de robots.txt et des cadences raisonnables.
- Contrôle de sites dont le client n'a pas prouvé la propriété (Business).
