-- WAVERTI — Moteur de règles personnalisées.
-- Mémoire par surveillance (éléments déjà vus, état de la règle, confirmation, délai entre alertes, panne en cours).
-- Données techniques bornées, sans contenu personnel. Aucune donnée existante n'est modifiée ni supprimée :
-- les surveillances créées avec l'ancien système conservent leur condition et leur fonctionnement.
alter table public.monitoring_tasks add column if not exists rule_state jsonb not null default '{}'::jsonb;
comment on column public.monitoring_tasks.rule_state is
  'Mémoire du moteur de règles (empreintes courtes des éléments déjà vus, état, confirmation). Bornée par le code.';
