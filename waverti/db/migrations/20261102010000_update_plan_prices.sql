-- WAVERTI — Nouveaux prix mensuels TTC (décision du propriétaire) : Plus 9,99 €, Pro 19,99 €, Max 29,99 € (inchangé), Business 49,99 €.
-- Les prix Stripe correspondants (mêmes clés de recherche) doivent être créés côté Stripe : le serveur refuse un paiement dont le montant
-- diffère du catalogue. Aucune donnée d'abonnement n'est modifiée ici (les abonnements existants gardent leur prix Stripe).
update public.plans set price_cents = 999 where id = 'plus';
update public.plans set price_cents = 1999 where id = 'pro';
update public.plans set price_cents = 4999 where id = 'business';
