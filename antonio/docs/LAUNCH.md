# Ouverture publique de Waverti

## Fonctionnel

- `/` : présentation publique animée, aperçu interactif explicitement illustratif, fonctionnalités, intégrations, tarifs indicatifs et FAQ.
- `/inscription?offre=pro` : vrai compte et préférence d'offre persistés ; aucun abonnement actif créé. Pas de données de démonstration par défaut.
- `/connexion` → `/app` : session authentifiée ; `/app` est l'espace personnel protégé. Le site public reste accessible à tous.
- Onboarding, préférences, choix d'offre et espace d'abonnement réels, enregistrés dans PostgreSQL.
- `/integrations` : connecteurs Google/Microsoft existants et API personnelle en lecture seule pour outils HTTP (Make, Zapier, n8n, etc.). Jetons affichés une seule fois, hachés en base, expirant après 30 jours, révocables. Export limité aux titres des tâches et aux prochains rendez-vous de leur propriétaire. Le champ `hasDemoData` signale un compte de démonstration.

## Stripe : préparé, pas encore ouvert à la vente

Le serveur utilise Stripe Checkout, un portail client et un webhook signé. Le prix est calculé côté serveur ; le client ne fournit jamais le montant. Une préférence et une URL de retour ne confirment jamais seules un abonnement. Le retour relit la session chez Stripe et vérifie son propriétaire. Les notifications sont signées sur le corps brut, dédupliquées, puis l'état courant de l'abonnement est relu chez Stripe pour gérer les notifications retardées.

La plateforme n'a pas encore reçu les identifiants Stripe. Ne pas activer les prélèvements avant un parcours complet en mode test et avant la mise en service réelle de l'IA, des connecteurs et du worker.

Variables Vercel :

- `STRIPE_SECRET_KEY` : commencer par une clé de mode test.
- `STRIPE_WEBHOOK_SECRET` : secret de l'endpoint `https://waverti.vercel.app/api/webhooks/stripe`.
- `BILLING_ENABLED=false` : conserver cette valeur tant que la vente n'est pas prête. `true` ouvre effectivement les paiements ; ce n'est pas un simple test d'affichage.

Événements Stripe : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

Activer le portail Stripe pour la consultation des factures, la mise à jour du moyen de paiement et la résiliation. Le changement de formule depuis le portail nécessite une configuration supplémentaire des produits/prix ; il ne faut pas l'annoncer comme disponible sans cette configuration.

Les limites de demandes écrites, de comptes et de voix sont contrôlées côté serveur lorsque la facturation est activée. Les budgets IA restent plafonnés séparément. Les recharges ne sont pas développées. La mesure vocale dépend encore du navigateur et ne constitue pas une garantie de coupure côté fournisseur ; conserver la facturation désactivée jusqu'à validation de la voix réelle et de ses limites.

## Connexions encore nécessaires

- `OPENAI_API_KEY` : texte et voix ; vérifier les modèles du compte, la qualité et les limites avant ouverture.
- Applications OAuth Google et Microsoft : variables et URI détaillées dans `OAUTH.md`.
- Worker permanent : voir `DEPLOY.md`. Le conteneur web Vercel peut s'arrêter sans trafic et ne garantit pas à lui seul une activité continue.
- CRM, documents, IMAP/CalDAV, iCloud et Yahoo : connecteurs natifs encore non développés. L'API personnelle lit les données Waverti, elle ne lit pas le CRM externe et ne peut pas y écrire directement.
- Identité de l'exploitant, contact et conditions commerciales définitives à fournir avant commercialisation ; aucun nom d'entreprise, certification ou engagement contractuel fictif n'a été ajouté.

Ne jamais coller de secrets dans une conversation, un ticket ou le dépôt. Les renseigner dans les variables Vercel, puis redéployer.

## Validation

Tests PostgreSQL : comptes et préférences, refus de facturer avant activation, signatures Stripe, idempotence des événements, restrictions d'abonnement, isolation des jetons, révocation, expiration, et suite d'acceptation existante. Les vrais services Stripe, OpenAI, Google et Microsoft ne sont pas appelés par ces tests.
Parcours visuel : présentation, tarifs, choix d'offre, création de compte, configuration complète et accès à l'espace personnel, sur ordinateur ; menu, présentation et FAQ sur téléphone.
