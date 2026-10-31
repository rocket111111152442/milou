# Facturation Stripe — Waverti

État : **mode test uniquement**. Les encaissements réels sont bloqués par le code tant que
`WAVERTI_ALLOW_LIVE_PAYMENTS=I_HAVE_LEGAL_APPROVAL` n'est pas défini (jamais fait par l'équipe technique sans
accord écrit et validation juridique).

## 1. Les quatre formules (seules vendues)

| Formule | Prix TTC / mois | Clé de recherche (lookup key) | Essai |
| --- | --- | --- | --- |
| Plus | 5,99 € | `waverti_plus_monthly` | 72 h, carte requise |
| Pro | 14,99 € | `waverti_pro_monthly` | 72 h, carte requise |
| Max | 29,99 € | `waverti_max_monthly` | 72 h, carte requise |
| Business | 39,99 € | `waverti_business_monthly` | 72 h, carte requise |

Le code ne contient **aucun identifiant `price_`** : à chaque création de paiement et à chaque changement de
formule, le serveur recherche le prix par sa clé de recherche et vérifie qu'il est actif, en EUR, mensuel
(1 mois), à l'unité, TTC (pas « hors taxes ») et d'un montant identique au catalogue. Sinon le paiement est
refusé (« formule non disponible au paiement ») : aucun prélèvement d'un montant inattendu n'est possible.
L'identifiant trouvé est mémorisé dans `plans.stripe_price_id` pour que les webhooks reconnaissent la formule.

## 2. Option abandonnée : site Business supplémentaire

L'ancienne option à 14,99 €/mois (`waverti_business_extra_site_monthly`) n'est plus affichée, ni proposée,
ni utilisée dans Checkout, ni comptée dans les droits ou le chiffre d'affaires. La ligne `plan_addons`
correspondante est conservée (`is_public = false`) ; aucune donnée ni aucun abonnement n'a été supprimé.
Un ancien élément d'abonnement portant ce prix est ignoré par la synchronisation (aucun droit supplémentaire).

**À faire dans Stripe (humain, facultatif)** : Produits → « site supplémentaire » → **Archiver** le prix
(et le produit). Archiver n'affecte pas les abonnements existants et ne supprime rien. Ne pas supprimer.
`pnpm stripe:prices` signale si ce prix est encore actif.

## 3. Essai de 72 heures

- Checkout en mode abonnement, `trial_end` = maintenant + 72 h, carte obligatoire
  (`payment_method_collection: always`), et résiliation automatique si aucun moyen de paiement
  (`trial_settings.end_behavior.missing_payment_method = cancel`).
- Aucun prélèvement pendant l'essai. La date et le montant du premier prélèvement sont affichés avant le
  paiement (case à cocher obligatoire), dans la notification de début d'essai et dans le rappel
  `customer.subscription.trial_will_end` (envoyé par Stripe dès le début d'un essai de 72 h).
- Résiliation avant la fin de l'essai : aucun prélèvement (`cancel_at_period_end`).
- Anti-abus : un seul essai par e-mail normalisé (alias `+`, points Gmail) et par empreinte de carte ; un
  deuxième essai avec la même carte est bloqué sans aucun prélèvement.
- Quotas réduits pendant l'essai : 3 surveillances, 1 sujet Web recherché au plus une fois par jour, 1 site
  Business.
- L'accès bêta (attribué par un administrateur) est indépendant de Stripe.

## 4. Webhook

URL : `https://www.waverti.com/api/stripe/webhook` (domaine public ; `www` obligatoire, le domaine nu redirige).
Événements : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.paid`,
`invoice.payment_failed` (facultatifs : `customer.subscription.paused`, `customer.subscription.resumed`).

Garanties testées : signature obligatoire (corps brut), idempotence (un événement rejoué n'est traité qu'une
fois, y compris en concurrence), ordre indifférent (l'abonnement est relu chez Stripe), réponse 500 en cas
d'échec pour que Stripe réessaie, événements enregistrés dans `billing_events`.

## 5. Gestion de l'abonnement par l'abonné

Page `/app/abonnement` : formule actuelle, état (essai, actif, impayé, résiliation programmée), date du
prochain prélèvement, changement de formule (proratisé : la différence est ajustée sur la prochaine facture,
aucun prélèvement immédiat), résiliation et reprise, et bouton « Factures et moyen de paiement » (portail
client Stripe).

**Réglages du portail client (humain, Stripe → Paramètres → Billing → Portail client)** : autoriser la mise à
jour du moyen de paiement, l'historique des factures et la résiliation en fin de période. Le changement de
formule dans le portail est facultatif (il existe déjà dans Waverti) ; s'il est activé, n'y proposer que les
quatre prix ci-dessus.

## 6. Droits

Calculés uniquement côté serveur à partir de l'état synchronisé par webhook signé ; le navigateur ne peut
jamais choisir sa formule ni ses quotas. Impayé : 7 jours de grâce, puis plus aucun droit. Résilié, impayé
définitif, expiré : surveillances mises en pause (rien n'est supprimé), reprises à la réactivation.

## 7. Contrôle de l'état

- `GET /api/health` → `billing.mode` : `absent`, `test`, `live_blocked` (clé live présente, paiements
  bloqués : le paiement est simplement indisponible) ou `live`. Jamais la clé.
- `GET /api/admin/billing-status` (administrateur) : mode, secret de webhook présent, et contrôle des quatre
  prix en lecture seule (uniquement avec une clé de test).
- `STRIPE_SECRET_KEY=… pnpm stripe:prices` : contrôle local en lecture seule ; `--create-test-catalog`
  (clé de test uniquement) crée les quatre prix de test s'ils manquent, sans jamais recréer un prix existant.

## 8. Actions humaines restantes avant tout test réel sur www.waverti.com

1. Stripe **mode test** : vérifier/créer les 4 prix avec leurs clés de recherche (ou `--create-test-catalog`).
2. Vercel (Production) : `STRIPE_SECRET_KEY` = clé `sk_test_…` (sensible) à la place de la clé live actuelle,
   puis `STRIPE_WEBHOOK_SECRET` = `whsec_…` de la destination de test.
3. Stripe (mode test) : destination webhook vers l'URL ci-dessus avec les événements listés ; régler le portail.
4. Tester avec la carte `4242 4242 4242 4242`, puis `4000 0000 0000 0341` (refus au premier prélèvement).

## 9. Conditions avant les paiements réels

CGV / mentions légales / confidentialité complétées et validées, statut TVA tranché (prix TTC affichés),
compte Stripe live activé, prix live créés avec les mêmes clés de recherche et vérifiés par
`pnpm stripe:prices`, webhook live et son secret, puis seulement : clé live + 
`WAVERTI_ALLOW_LIVE_PAYMENTS=I_HAVE_LEGAL_APPROVAL`, sur décision écrite du responsable.
