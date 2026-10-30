-- WATCHLY — formules commerciales (prix TTC en centimes d'euro). Aucune formule gratuite permanente :
-- chaque formule commence par un essai de 72 h avec carte bancaire.
-- Les identifiants de prix Stripe sont renseignés par `pnpm db:seed` à partir des variables
-- d'environnement (STRIPE_PRICE_*), jamais en dur.

insert into public.plans (
  id, name, description, price_cents, trial_hours, sort_order, stripe_lookup_key,
  max_monitors, max_web_topics, page_interval_minutes, web_interval_minutes,
  cloud_relay, email_alerts, history_days, advanced_history, data_exports, monthly_search_calls, monthly_email_alerts,
  business_sites_included, business_endpoints_per_site, business_http_interval_seconds,
  business_scenarios_per_site, business_scenario_interval_minutes, business_tls_checks, priority_alerts,
  trial_max_monitors, trial_max_web_topics, trial_max_business_sites, trial_daily_search_calls, trial_email_alerts
) values
  -- Recherches mensuelles = sujets × recherches par jour × 30 : un abonné qui utilise 100 % de ses
  -- sujets reste dans son plafond (Plus 3×1×30 = 90, Pro 10×2×30 = 600, Max 20×2×30 = 1 200).
  ('plus', 'Plus', 'L''essentiel pour suivre vos pages et quelques sujets sur Internet.', 599, 72, 20, 'waverti_plus_monthly',
   20, 3, 360, 1440,
   true, true, 90, false, false, 90, 30,
   0, 0, 60, 0, 120, false, false,
   3, 1, 0, 2, 10),
  ('pro', 'Pro', 'Pour les usages réguliers : 100 surveillances, historique avancé et exports.', 1499, 72, 30, 'waverti_pro_monthly',
   100, 10, 120, 720,
   true, true, 365, true, true, 600, 80,
   0, 0, 60, 0, 120, false, false,
   3, 1, 0, 2, 10),
  ('max', 'Max', 'Pour les utilisateurs intensifs : 150 surveillances, 20 sujets, pages vérifiées chaque heure.', 2999, 72, 35, 'waverti_max_monthly',
   150, 20, 60, 720,
   true, true, 365, true, true, 1200, 150,
   0, 0, 60, 0, 120, false, false,
   3, 1, 0, 2, 10),
  ('business', 'Business', 'Toutes les fonctions Pro + la surveillance de votre site professionnel.', 3999, 72, 40, 'waverti_business_monthly',
   100, 10, 120, 720,
   true, true, 365, true, true, 600, 150,
   1, 3, 60, 1, 120, true, true,
   3, 1, 1, 2, 10)
on conflict (id) do nothing;

-- Site supplémentaire : disponibilité (3 points de contrôle) et HTTPS ; aucun scénario navigateur inclus.
insert into public.plan_addons (id, name, price_cents, requires_plan_id, grants_business_sites, stripe_lookup_key)
values ('business_extra_site', 'Site professionnel supplémentaire', 1499, 'business', 1, 'waverti_business_extra_site_monthly')
on conflict (id) do nothing;

insert into public.app_settings (key, value) values
  -- Budget mensuel maximal des API payantes (euros). Au-delà, les recherches non prioritaires sont suspendues.
  ('budget.monthly_api_eur', '50'::jsonb),
  -- Coût estimé par appel (micro-euros). À ajuster selon le contrat Brave Search réellement souscrit.
  ('cost.brave_search_call_micros', '5000'::jsonb),
  ('cost.resend_email_micros', '400'::jsonb),
  ('cost.playwright_run_micros', '2000'::jsonb),
  ('cost.http_fetch_micros', '20'::jsonb),
  -- Délai de grâce pendant lequel l'application desktop peut prendre une tâche avant le relais cloud.
  ('hybrid.agent_grace_seconds', '600'::jsonb),
  ('hybrid.agent_offline_after_seconds', '180'::jsonb),
  -- Conservation des données (jours)
  ('retention.business_checks_days', '30'::jsonb),
  ('retention.agent_heartbeats_days', '7'::jsonb),
  ('retention.finished_jobs_days', '14'::jsonb),
  ('retention.api_usage_days', '400'::jsonb),
  ('retention.artifacts_days', '30'::jsonb),
  ('retention.rate_limits_hours', '48'::jsonb)
on conflict (key) do nothing;
