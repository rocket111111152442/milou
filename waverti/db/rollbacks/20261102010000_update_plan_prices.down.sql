-- RETOUR ARRIÈRE de 20261102010000_update_plan_prices.sql — à exécuter À LA MAIN (jamais lu par le migrateur ni par un déploiement).
-- Rétablit les anciens montants TTC (Plus 5,99 €, Pro 14,99 €, Business 39,99 € ; Max 29,99 € n'a jamais changé).
-- Ne touche ni aux abonnements, ni aux comptes, ni à Stripe. Idempotent.
-- Après exécution, retirer aussi la ligne de suivi pour que la migration puisse être rejouée plus tard :
--   delete from waverti_migrations.schema_migrations where version = '20261102010000';
begin;
update public.plans set price_cents = 599 where id = 'plus';
update public.plans set price_cents = 1499 where id = 'pro';
update public.plans set price_cents = 3999 where id = 'business';
select id, price_cents from public.plans where id in ('plus', 'pro', 'max', 'business') order by id;
commit;
