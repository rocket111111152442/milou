-- WAVERTI — Abandon de l'option « site professionnel supplémentaire » (14,99 €/mois).
-- Business comprend un site professionnel surveillé. L'option n'est plus ni affichée ni vendue ; aucune donnée
-- n'est supprimée (la ligne et l'éventuel historique restent pour la traçabilité).
update public.plan_addons set is_public = false where id = 'business_extra_site';
comment on table public.plan_addons is 'Options d''abonnement. business_extra_site : abandonnée le 31/10/2026, non vendue, sans effet sur les droits.';
