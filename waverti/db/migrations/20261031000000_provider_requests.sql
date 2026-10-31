-- WAVERTI — Compteur technique des appels aux services externes (Brave Search, e-mails).
--
-- Distinct des quotas d'abonnés (usage_counters) et de la consommation par utilisateur (api_usage) :
-- chaque requête réellement émise vers le fournisseur est journalisée (succès, échec, nouvelle
-- tentative, limite de débit), avec son coût estimé. Le coût réel, connu seulement par la facture du
-- fournisseur, est saisi par mois dans provider_monthly_costs (administration).
-- Tables d'exploitation : accessibles au serveur uniquement (RLS activée, aucun droit pour app_user).

create table public.provider_requests (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  provider text not null check (provider in ('brave_search', 'resend', 'smtp')),
  user_id uuid references public.profiles (id) on delete set null,
  outcome text not null check (outcome in ('success', 'failure', 'rate_limited', 'timeout')),
  http_status smallint,
  attempt smallint not null default 1 check (attempt >= 1),
  is_retry boolean not null default false,
  latency_ms integer check (latency_ms >= 0),
  estimated_cost_micros bigint not null default 0 check (estimated_cost_micros >= 0),
  -- Quota restant / total annoncé par le fournisseur (en-têtes X-RateLimit-* de Brave), si présent.
  provider_quota_remaining integer,
  provider_quota_limit integer,
  error text
);
create index provider_requests_provider_time_idx on public.provider_requests (provider, occurred_at);

create table public.provider_monthly_costs (
  provider text not null check (provider in ('brave_search', 'resend', 'smtp', 'vercel', 'server', 'other')),
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  actual_cost_micros bigint not null check (actual_cost_micros >= 0),
  note text check (char_length(note) <= 500),
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (provider, month)
);

alter table public.provider_requests enable row level security;
alter table public.provider_monthly_costs enable row level security;
revoke all on public.provider_requests, public.provider_monthly_costs from app_user;

-- Coût estimé d'un e-mail (micro-euros) et plafond technique des alertes Business (hors quota de la formule).
insert into public.app_settings (key, value) values
  ('cost.email_micros', '400'::jsonb),
  ('limit.business_alert_emails_per_day', '60'::jsonb),
  ('limit.business_flapping_per_hour', '4'::jsonb)
on conflict (key) do nothing;
-- cost.email_micros : coût estimé d'un e-mail envoyé (micro-euros), à ajuster selon la facture du fournisseur.
-- limit.business_alert_emails_per_day : plafond technique anti-abus des e-mails de panne / rétablissement
--   Business par compte et par 24 h (ces e-mails ne sont pas décomptés du quota de la formule).
-- limit.business_flapping_per_hour : au-delà, le site est signalé instable et les e-mails suivants regroupés.

-- Anti-répétition des alertes Business : recherche des e-mails récents par site.
create index notifications_site_time_idx on public.notifications (site_id, created_at desc) where site_id is not null;

-- Quotas de recherche par période facturée : clé « bp:AAAA-MM-JJ » (début de la période Stripe).
alter table public.usage_counters drop constraint usage_counters_period_check;
alter table public.usage_counters add constraint usage_counters_period_check
  check (period ~ '^([0-9]{4}-[0-9]{2}(-[0-9]{2})?|bp:[0-9]{4}-[0-9]{2}-[0-9]{2})$');
