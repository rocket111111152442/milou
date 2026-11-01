-- WAVERTI — Inventaire LECTURE SEULE des données issues de Brave Search (aucune modification).
-- À exécuter sur la base voulue (Production ou test) par le propriétaire : la transaction est déclarée en lecture seule,
-- toute tentative d'écriture échouerait. Ne renvoie que des COMPTEURS (aucun titre, adresse ni texte d'utilisateur).
begin read only;

select 'search_cache (brave, brave_products) — À SUPPRIMER sans droits' as donnee,
       count(*) as lignes, min(fetched_at) as plus_ancienne, max(fetched_at) as plus_recente
from search_cache where provider in ('brave', 'brave_products');

select 'monitoring_seen_items web_topic avec adresse/titre — À VIDER (la clé de déduplication est un hachage, conservée)' as donnee,
       count(*) as lignes, min(s.first_seen_at) as plus_ancienne, max(s.first_seen_at) as plus_recente
from monitoring_seen_items s join monitoring_tasks t on t.id = s.task_id
where t.kind = 'web_topic' and (s.url <> '' or s.title is not null);

select 'monitoring_results web_topic avec constats non masqués — À MASQUER' as donnee,
       count(*) as lignes, min(r.checked_at) as plus_ancienne, max(r.checked_at) as plus_recente
from monitoring_results r
where r.observation ->> 'kind' = 'web_topic'
  and exists (select 1 from jsonb_array_elements(coalesce(r.observation -> 'findings', '[]'::jsonb)) f
              where coalesce((f ->> 'redacted')::boolean, false) = false);

-- Historique visible des abonnés : ne sera modifié QUE sur décision explicite du propriétaire (scrubHistory).
select 'notifications web_topic avec titre/texte/adresse issus de Brave — DÉCISION DU PROPRIÉTAIRE' as donnee,
       count(*) as lignes, min(created_at) as plus_ancienne, max(created_at) as plus_recente
from notifications where type = 'web_topic' and (source_url is not null or title <> 'Nouvelle information détectée');

select 'email_outbox (e-mails de recherche de sujets déjà envoyés) — DÉCISION DU PROPRIÉTAIRE' as donnee,
       count(*) as lignes, min(e.created_at) as plus_ancienne, max(e.created_at) as plus_recente
from email_outbox e join notifications nt on nt.id = e.notification_id
where nt.type = 'web_topic' and e.status in ('sent', 'canceled', 'failed') and e.payload <> '{"redacted": true}'::jsonb;

-- E-mails encore en attente : leur contenu partira avec des résultats Brave si rien n'est fait.
select 'email_outbox en attente (pending/sending) de type recherche de sujets — À TRAITER AVANT ENVOI' as donnee,
       count(*) as lignes
from email_outbox e join notifications nt on nt.id = e.notification_id
where nt.type = 'web_topic' and e.status in ('pending', 'sending');

-- Conservé dans tous les cas (métadonnées techniques) : compteurs d'appels, coûts, statuts.
select 'provider_requests brave_search (métadonnées techniques — conservées)' as donnee,
       count(*) as lignes, count(*) filter (where error is not null) as avec_message_erreur
from provider_requests where provider = 'brave_search';

select 'Surveillances de sujets (web_topic) actives' as donnee, count(*) as lignes
from monitoring_tasks where kind = 'web_topic';

rollback;
