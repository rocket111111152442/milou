-- WAVERTI — schéma principal
-- Compatible Supabase (schéma auth existant) et PostgreSQL 15+ (avec le shim local pour les tests).
-- Conventions :
--   * statuts en text + CHECK (plus simples à faire évoluer que les ENUM) ;
--   * toutes les tables utilisateur portent user_id pour la RLS et les requêtes de quota ;
--   * suppression d'un compte => ON DELETE CASCADE sur les données personnelles,
--     ON DELETE SET NULL sur les journaux nécessaires à la comptabilité / sécurité.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Formules (paramétrables)
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z_]+$'),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents > 0), -- aucune formule gratuite permanente
  currency text not null default 'eur',
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  stripe_price_id text unique,
  -- Clé de recherche (lookup_key) du prix Stripe : permet de retrouver le price_ réel sans le saisir à la main.
  stripe_lookup_key text unique,
  trial_hours integer not null default 0 check (trial_hours >= 0),
  is_public boolean not null default true,
  sort_order integer not null default 0,
  -- quotas surveillances personnelles
  max_monitors integer not null check (max_monitors >= 0),
  max_web_topics integer not null check (max_web_topics >= 0),
  page_interval_minutes integer not null check (page_interval_minutes > 0),
  web_interval_minutes integer check (web_interval_minutes is null or web_interval_minutes > 0),
  cloud_relay boolean not null default false,
  email_alerts boolean not null default false,
  history_days integer not null default 30 check (history_days > 0),
  advanced_history boolean not null default false,
  data_exports boolean not null default false,
  monthly_search_calls integer not null default 0 check (monthly_search_calls >= 0),
  monthly_email_alerts integer not null default 0 check (monthly_email_alerts >= 0),
  -- quotas Business (par site ; les scénarios ne concernent que les sites inclus, pas les sites supplémentaires)
  business_sites_included integer not null default 0 check (business_sites_included >= 0),
  business_endpoints_per_site integer not null default 0,
  business_http_interval_seconds integer not null default 60 check (business_http_interval_seconds >= 60),
  business_scenarios_per_site integer not null default 0,
  business_scenario_interval_minutes integer not null default 120 check (business_scenario_interval_minutes >= 60),
  business_tls_checks boolean not null default false,
  priority_alerts boolean not null default false,
  -- restrictions pendant l'essai
  trial_max_monitors integer not null default 3,
  trial_max_web_topics integer not null default 1,
  trial_max_business_sites integer not null default 1,
  trial_daily_search_calls integer not null default 2,
  trial_email_alerts integer not null default 10 check (trial_email_alerts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_touch before update on public.plans
  for each row execute function private.touch_updated_at();

create table public.plan_addons (
  id text primary key check (id ~ '^[a-z_]+$'),
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'eur',
  stripe_price_id text unique,
  stripe_lookup_key text unique,
  requires_plan_id text not null references public.plans (id),
  grants_business_sites integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profils (1-1 avec auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  role text not null default 'user' check (role in ('user', 'business', 'admin')),
  locale text not null default 'fr' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  timezone text not null default 'Europe/Paris',
  notify_email boolean not null default true,
  notify_inapp boolean not null default true,
  notify_desktop boolean not null default true,
  marketing_opt_in boolean not null default false,
  onboarding_step text not null default 'welcome',
  onboarding_completed_at timestamptz,
  stripe_customer_id text unique,
  suspended_at timestamptz,
  suspension_reason text,
  deletion_requested_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role) where role <> 'user';
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Abonnements & droits
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  status text not null check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  )),
  extra_sites integer not null default 0 check (extra_sites >= 0),
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  -- horodatage Stripe du dernier événement appliqué (protection contre le désordre des webhooks)
  last_event_at timestamptz,
  trial_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create unique index subscriptions_one_live_per_user
  on public.subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due', 'unpaid');
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function private.touch_updated_at();

-- Droits effectifs, recalculés côté serveur uniquement (jamais par le client).
create table public.entitlements (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan_id text references public.plans (id), -- null : aucun abonnement valide (pas de formule gratuite)
  source text not null check (source in ('none', 'trial', 'subscription', 'grace', 'admin_grant')),
  check ((source = 'none') = (plan_id is null)),
  subscription_status text,
  max_monitors integer not null,
  max_web_topics integer not null,
  page_interval_minutes integer not null,
  web_interval_minutes integer,
  cloud_relay boolean not null,
  email_alerts boolean not null,
  history_days integer not null,
  advanced_history boolean not null,
  data_exports boolean not null,
  monthly_search_calls integer not null,
  daily_search_calls integer,
  monthly_email_alerts integer not null default 0,
  business_sites integer not null,
  business_endpoints_per_site integer not null,
  business_http_interval_seconds integer not null,
  business_scenarios_per_site integer not null,
  business_scenarios_total integer not null default 0, -- scénarios inclus pour tout le compte (sites supplémentaires : aucun)
  business_scenario_interval_minutes integer not null,
  business_tls_checks boolean not null,
  priority_alerts boolean not null,
  valid_until timestamptz,
  computed_at timestamptz not null default now()
);

-- Compteurs de consommation des ressources facturables (recherches, alertes e-mail, appels IA…).
-- Incrément atomique conditionnel : la réservation échoue si la limite serait dépassée (pas de dépassement
-- même avec plusieurs workers en parallèle). user_id null : compteur global (budget de la plateforme).
create table public.usage_counters (
  user_id uuid references public.profiles (id) on delete cascade,
  metric text not null check (metric ~ '^[a-z_]+$'),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'),
  value bigint not null default 0 check (value >= 0),
  updated_at timestamptz not null default now(),
  constraint usage_counters_key unique nulls not distinct (user_id, metric, period)
);
create index usage_counters_metric_period_idx on public.usage_counters (metric, period);

-- Prévention des essais répétés : empreintes hachées (pas d'e-mail ni de numéro de carte en clair).
create table public.trial_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email_hash text not null,
  card_fingerprint_hash text,
  plan_id text not null references public.plans (id),
  stripe_subscription_id text,
  status text not null default 'started' check (status in ('started', 'converted', 'canceled', 'blocked_duplicate')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index trial_usage_email_once on public.trial_usage (email_hash)
  where status <> 'blocked_duplicate';
create unique index trial_usage_card_once on public.trial_usage (card_fingerprint_hash)
  where card_fingerprint_hash is not null and status <> 'blocked_duplicate';
create index trial_usage_user_idx on public.trial_usage (user_id);

create table public.billing_events (
  id text primary key, -- identifiant d'événement Stripe (idempotence)
  type text not null,
  stripe_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  attempts integer not null default 0,
  error text,
  user_id uuid references public.profiles (id) on delete set null,
  -- extrait minimal de l'événement (pas d'adresse ni de données de carte)
  summary jsonb not null default '{}'::jsonb
);
create index billing_events_type_idx on public.billing_events (type, received_at desc);
create index billing_events_failed_idx on public.billing_events (status) where status = 'failed';

-- ---------------------------------------------------------------------------
-- Appareils (application desktop)
-- ---------------------------------------------------------------------------
create table public.agent_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  platform text not null check (platform in ('windows', 'macos', 'linux')),
  app_version text,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  consent_local_at timestamptz,
  consent_version text,
  monitoring_enabled boolean not null default false,
  last_seen_at timestamptz,
  last_state text check (last_state in ('idle', 'running', 'paused')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index agent_devices_user_idx on public.agent_devices (user_id) where status = 'active';

create table public.agent_link_requests (
  id uuid primary key default gen_random_uuid(),
  device_code_hash text not null unique,
  user_code text not null unique check (user_code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  device_name text not null check (char_length(device_name) between 1 and 80),
  platform text not null check (platform in ('windows', 'macos', 'linux')),
  app_version text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'consumed', 'expired')),
  user_id uuid references public.profiles (id) on delete cascade,
  device_id uuid references public.agent_devices (id) on delete set null,
  expires_at timestamptz not null,
  approved_at timestamptz,
  last_polled_at timestamptz,
  created_at timestamptz not null default now()
);
create index agent_link_requests_expiry_idx on public.agent_link_requests (expires_at) where status = 'pending';

create table public.agent_heartbeats (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.agent_devices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  received_at timestamptz not null default now(),
  state text not null check (state in ('idle', 'running', 'paused')),
  running_jobs integer not null default 0 check (running_jobs >= 0),
  app_version text
);
create index agent_heartbeats_device_idx on public.agent_heartbeats (device_id, received_at desc);
create index agent_heartbeats_received_idx on public.agent_heartbeats (received_at);

-- ---------------------------------------------------------------------------
-- Surveillances personnelles (moteurs A et B)
-- ---------------------------------------------------------------------------
create table public.monitoring_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('page', 'web_topic')),
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'paused', 'paused_quota', 'error')),
  condition jsonb not null,
  execution_mode text not null default 'auto' check (execution_mode in ('auto', 'local_only', 'cloud_only')),
  notify_inapp boolean not null default true,
  notify_email boolean not null default true,
  notify_desktop boolean not null default true,
  last_status text not null default 'pending' check (last_status in ('pending', 'ok', 'triggered', 'error', 'skipped')),
  last_checked_at timestamptz,
  last_triggered_at timestamptz,
  last_error text,
  consecutive_errors integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index monitoring_tasks_user_idx on public.monitoring_tasks (user_id, created_at desc);
create index monitoring_tasks_user_kind_idx on public.monitoring_tasks (user_id, kind) where status in ('active', 'error');
create trigger monitoring_tasks_touch before update on public.monitoring_tasks
  for each row execute function private.touch_updated_at();

create table public.monitoring_targets (
  task_id uuid primary key references public.monitoring_tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('url', 'search_topic')),
  url text check (url is null or char_length(url) <= 2048),
  url_hash text,
  host text,
  css_selector text check (css_selector is null or char_length(css_selector) <= 300),
  render_mode text not null default 'auto' check (render_mode in ('auto', 'http', 'browser')),
  topic text check (topic is null or char_length(topic) <= 500),
  search_queries text[] not null default '{}',
  official_domains text[] not null default '{}',
  require_official boolean not null default false,
  check (
    (target_type = 'url' and url is not null and host is not null and url_hash is not null)
    or (target_type = 'search_topic' and topic is not null)
  )
);
create index monitoring_targets_url_hash_idx on public.monitoring_targets (url_hash) where url_hash is not null;
create index monitoring_targets_host_idx on public.monitoring_targets (host) where host is not null;

create table public.monitoring_schedules (
  task_id uuid primary key references public.monitoring_tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  interval_minutes integer not null check (interval_minutes between 1 and 10080),
  next_run_at timestamptz not null,
  last_scheduled_at timestamptz,
  jitter_seconds integer not null default 0 check (jitter_seconds between 0 and 3600),
  updated_at timestamptz not null default now()
);
create index monitoring_schedules_due_idx on public.monitoring_schedules (next_run_at);
create trigger monitoring_schedules_touch before update on public.monitoring_schedules
  for each row execute function private.touch_updated_at();

create table public.monitoring_jobs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.monitoring_tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('page', 'web_topic')),
  slot_at timestamptz not null,
  status text not null default 'pending' check (status in (
    'pending', 'claimed', 'succeeded', 'failed', 'skipped', 'expired', 'canceled'
  )),
  preferred_executor text not null check (preferred_executor in ('agent', 'cloud')),
  allow_cloud boolean not null,
  allow_agent boolean not null,
  agent_deadline_at timestamptz,
  claimed_by text check (claimed_by in ('agent', 'cloud')),
  claimed_device_id uuid references public.agent_devices (id) on delete set null,
  claim_token uuid,
  worker_id text,
  lease_expires_at timestamptz,
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  priority integer not null default 100,
  manual boolean not null default false,
  last_error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  unique (task_id, slot_at),
  check (status <> 'claimed' or (claimed_by is not null and claim_token is not null and lease_expires_at is not null))
);
-- Une seule exécution en cours par surveillance : le PC et le serveur ne peuvent pas lancer le même contrôle.
create unique index monitoring_jobs_one_live_per_task
  on public.monitoring_jobs (task_id) where status in ('pending', 'claimed');
create index monitoring_jobs_queue_idx
  on public.monitoring_jobs (priority, slot_at) where status = 'pending';
create index monitoring_jobs_user_pending_idx
  on public.monitoring_jobs (user_id, slot_at) where status = 'pending';
create index monitoring_jobs_lease_idx
  on public.monitoring_jobs (lease_expires_at) where status = 'claimed';
create index monitoring_jobs_task_idx on public.monitoring_jobs (task_id, created_at desc);
create index monitoring_jobs_finished_idx on public.monitoring_jobs (finished_at) where finished_at is not null;

create table public.monitoring_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid unique references public.monitoring_jobs (id) on delete set null,
  task_id uuid not null references public.monitoring_tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  executed_by text not null check (executed_by in ('agent', 'cloud')),
  device_id uuid references public.agent_devices (id) on delete set null,
  checked_at timestamptz not null default now(),
  outcome text not null check (outcome in ('ok', 'changed', 'triggered', 'error')),
  observation jsonb,
  change_summary jsonb,
  error_code text,
  error_message text,
  duration_ms integer,
  from_cache boolean not null default false
);
create index monitoring_results_task_idx on public.monitoring_results (task_id, checked_at desc);
create index monitoring_results_user_idx on public.monitoring_results (user_id, checked_at desc);

-- Déduplication des informations trouvées par le moteur de recherche (par surveillance).
create table public.monitoring_seen_items (
  task_id uuid not null references public.monitoring_tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  url text not null,
  title text,
  classification text not null check (classification in ('confirmed', 'probable', 'rumor', 'irrelevant')),
  first_seen_at timestamptz not null default now(),
  primary key (task_id, fingerprint)
);

-- ---------------------------------------------------------------------------
-- Caches partagés (uniquement des contenus publics, jamais de données privées d'un utilisateur)
-- ---------------------------------------------------------------------------
create table public.search_cache (
  query_hash text primary key,
  provider text not null,
  query text not null,
  results jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  hit_count integer not null default 0
);
create index search_cache_expiry_idx on public.search_cache (expires_at);

create table public.page_cache (
  cache_key text primary key, -- hash(url normalisée + configuration d'extraction)
  url_hash text not null,
  observation jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  hit_count integer not null default 0
);
create index page_cache_expiry_idx on public.page_cache (expires_at);

-- ---------------------------------------------------------------------------
-- Business
-- ---------------------------------------------------------------------------
create table public.business_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  domain text not null check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'suspended')),
  verification_token text not null,
  verification_method text check (verification_method in ('dns', 'file')),
  verified_at timestamptz,
  last_verification_attempt_at timestamptz,
  tls_valid_to timestamptz,
  tls_issuer text,
  tls_checked_at timestamptz,
  tls_error text,
  next_tls_check_at timestamptz,
  tls_lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, domain)
);
create index business_sites_tls_due_idx on public.business_sites (next_tls_check_at) where status = 'verified';
create trigger business_sites_touch before update on public.business_sites
  for each row execute function private.touch_updated_at();

create table public.site_verifications (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.business_sites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  method text not null check (method in ('dns', 'file')),
  success boolean not null,
  detail text,
  attempted_at timestamptz not null default now()
);
create index site_verifications_site_idx on public.site_verifications (site_id, attempted_at desc);

create table public.business_endpoints (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.business_sites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  url text not null check (char_length(url) <= 2048),
  method text not null default 'GET' check (method in ('GET', 'HEAD')),
  expected_status_min integer not null default 200,
  expected_status_max integer not null default 399,
  expected_keyword text check (expected_keyword is null or char_length(expected_keyword) <= 200),
  timeout_ms integer not null default 10000 check (timeout_ms between 1000 and 30000),
  interval_seconds integer not null default 60 check (interval_seconds >= 60),
  slow_threshold_ms integer not null default 3000,
  enabled boolean not null default true,
  state text not null default 'unknown' check (state in ('unknown', 'up', 'down', 'degraded')),
  consecutive_failures integer not null default 0,
  consecutive_successes integer not null default 0,
  last_checked_at timestamptz,
  last_response_ms integer,
  last_status_code integer,
  last_error text,
  next_check_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  lease_owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_status_min between 100 and 599 and expected_status_max between expected_status_min and 599)
);
create index business_endpoints_due_idx on public.business_endpoints (next_check_at) where enabled;
create index business_endpoints_site_idx on public.business_endpoints (site_id);
create trigger business_endpoints_touch before update on public.business_endpoints
  for each row execute function private.touch_updated_at();

create table public.business_checks (
  id bigint generated always as identity primary key,
  endpoint_id uuid not null references public.business_endpoints (id) on delete cascade,
  site_id uuid not null references public.business_sites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_at timestamptz not null default now(),
  ok boolean not null,
  status_code integer,
  response_ms integer,
  error_code text,
  is_confirmation boolean not null default false
);
create index business_checks_endpoint_idx on public.business_checks (endpoint_id, checked_at desc);
create index business_checks_site_idx on public.business_checks (site_id, checked_at desc);
create index business_checks_time_idx on public.business_checks (checked_at);

create table public.business_daily_stats (
  endpoint_id uuid not null references public.business_endpoints (id) on delete cascade,
  site_id uuid not null references public.business_sites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  checks integer not null default 0,
  failures integer not null default 0,
  avg_response_ms integer,
  p95_response_ms integer,
  downtime_seconds integer not null default 0,
  primary key (endpoint_id, day)
);
create index business_daily_stats_site_idx on public.business_daily_stats (site_id, day desc);

create table public.browser_test_scenarios (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.business_sites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  start_url text not null check (char_length(start_url) <= 2048),
  steps jsonb not null,
  interval_minutes integer not null default 120 check (interval_minutes >= 60),
  enabled boolean not null default true,
  next_run_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  lease_owner text,
  consecutive_failures integer not null default 0,
  last_status text check (last_status in ('passed', 'failed', 'error')),
  last_run_at timestamptz,
  last_duration_ms integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index browser_test_scenarios_due_idx on public.browser_test_scenarios (next_run_at) where enabled;
create trigger browser_test_scenarios_touch before update on public.browser_test_scenarios
  for each row execute function private.touch_updated_at();

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('screenshot')),
  content_type text not null check (content_type in ('image/jpeg', 'image/png')),
  bytes bytea not null check (octet_length(bytes) <= 2000000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index artifacts_expiry_idx on public.artifacts (expires_at);

create table public.browser_test_runs (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.browser_test_scenarios (id) on delete cascade,
  site_id uuid not null references public.business_sites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('passed', 'failed', 'error')),
  failed_step integer,
  error text,
  screenshot_id uuid references public.artifacts (id) on delete set null,
  duration_ms integer,
  step_results jsonb not null default '[]'::jsonb
);
create index browser_test_runs_scenario_idx on public.browser_test_runs (scenario_id, started_at desc);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.business_sites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint_id uuid references public.business_endpoints (id) on delete set null,
  scenario_id uuid references public.browser_test_scenarios (id) on delete set null,
  kind text not null check (kind in ('downtime', 'tls', 'scenario')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  title text not null,
  cause text,
  started_at timestamptz not null,
  confirmed_at timestamptz,
  resolved_at timestamptz,
  last_error text,
  screenshot_id uuid references public.artifacts (id) on delete set null,
  failed_checks integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index incidents_one_open_per_endpoint
  on public.incidents (endpoint_id, kind) where status = 'open' and endpoint_id is not null;
create unique index incidents_one_open_per_scenario
  on public.incidents (scenario_id) where status = 'open' and scenario_id is not null;
create unique index incidents_one_open_tls_per_site
  on public.incidents (site_id) where status = 'open' and kind = 'tls';
create index incidents_site_idx on public.incidents (site_id, started_at desc);
create index incidents_user_idx on public.incidents (user_id, started_at desc);

create table public.incident_events (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  type text not null check (type in ('detected', 'confirmed', 'notified', 'check_failed', 'recovered', 'note')),
  message text not null
);
create index incident_events_incident_idx on public.incident_events (incident_id, at);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'price', 'stock', 'page_change', 'keyword', 'web_topic',
    'business_down', 'business_recovered', 'business_tls', 'business_scenario',
    'subscription', 'trial', 'system'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  title text not null check (char_length(title) <= 200),
  body text not null check (char_length(body) <= 2000),
  task_id uuid references public.monitoring_tasks (id) on delete set null,
  task_name text,
  site_id uuid references public.business_sites (id) on delete set null,
  incident_id uuid references public.incidents (id) on delete set null,
  result_id uuid references public.monitoring_results (id) on delete set null,
  source_url text,
  link_path text,
  dedup_key text,
  email_status text not null default 'none' check (email_status in ('none', 'pending', 'sent', 'failed', 'skipped')),
  desktop_status text not null default 'none' check (desktop_status in ('none', 'pending', 'delivered')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index notifications_dedup_idx on public.notifications (user_id, dedup_key) where dedup_key is not null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_desktop_pending_idx on public.notifications (user_id) where desktop_status = 'pending';

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete cascade,
  to_email text not null,
  template text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'canceled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_error text,
  provider_message_id text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_queue_idx on public.email_outbox (next_attempt_at) where status in ('pending', 'sending');

-- ---------------------------------------------------------------------------
-- Exploitation, coûts, administration
-- ---------------------------------------------------------------------------
create table public.api_usage (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  provider text not null check (provider in ('brave_search', 'resend', 'playwright', 'http_fetch', 'tls_check')),
  user_id uuid references public.profiles (id) on delete set null,
  plan_id text,
  units integer not null default 1 check (units >= 0),
  estimated_cost_micros bigint not null default 0, -- micro-euros
  executed_by text check (executed_by in ('agent', 'cloud')),
  cache_hit boolean not null default false,
  meta jsonb not null default '{}'::jsonb
);
create index api_usage_time_idx on public.api_usage (occurred_at);
create index api_usage_user_idx on public.api_usage (user_id, occurred_at);
create index api_usage_provider_idx on public.api_usage (provider, occurred_at);

create table public.worker_heartbeats (
  worker_id text primary key,
  hostname text not null,
  version text,
  role text not null default 'all',
  started_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  jobs_succeeded bigint not null default 0,
  jobs_failed bigint not null default 0,
  stats jsonb not null default '{}'::jsonb
);

create table public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_time_idx on public.admin_audit_logs (created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  subject text not null check (char_length(subject) between 3 and 200),
  category text not null default 'other' check (category in ('account', 'billing', 'monitoring', 'business', 'desktop', 'privacy', 'abuse', 'other')),
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index support_tickets_user_idx on public.support_tickets (user_id);
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function private.touch_updated_at();

create table public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  author text not null check (author in ('user', 'staff')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);
create index rate_limits_window_idx on public.rate_limits (window_start);

create table public.desktop_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$'),
  platform text not null check (platform in ('windows', 'macos', 'linux')),
  arch text not null check (arch in ('x86_64', 'aarch64', 'universal')),
  package_type text not null check (package_type in ('msi', 'nsis', 'dmg', 'appimage', 'deb', 'rpm')),
  url text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint,
  code_signed boolean not null default false,
  updater_signature text,
  tested_on text,
  notes text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (version, platform, arch, package_type)
);

create table public.account_deletions (
  id bigint generated always as identity primary key,
  user_ref text not null, -- identifiant pseudonymisé (hash), pas d'e-mail
  requested_at timestamptz not null,
  completed_at timestamptz not null default now(),
  stripe_cancellation text
);

-- ---------------------------------------------------------------------------
-- Synchronisation auth.users -> profiles
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();
