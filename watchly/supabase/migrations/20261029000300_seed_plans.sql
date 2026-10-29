-- WATCHLY — formules commerciales envisagées (prix TTC en centimes d'euro).
-- Les identifiants de prix Stripe sont renseignés par `pnpm db:seed` à partir des variables
-- d'environnement (STRIPE_PRICE_*), jamais en dur.

insert into public.plans (
  id, name, description, price_cents, trial_hours, sort_order,
  max_monitors, max_web_topics, page_interval_minutes, web_interval_minutes,
  cloud_relay, email_alerts, history_days, advanced_history, data_exports, monthly_search_calls,
  business_sites_included, business_endpoints_per_site, business_http_interval_seconds,
  business_scenarios_per_site, business_scenario_interval_minutes, business_tls_checks, priority_alerts,
  trial_max_monitors, trial_max_web_topics, trial_max_business_sites, trial_daily_search_calls
) values
  ('discovery', 'Découverte', 'Surveillance locale de quelques pages, sans carte bancaire.', 0, 0, 10,
   3, 0, 720, null,
   false, false, 30, false, false, 0,
   0, 0, 60, 0, 120, false, false,
   3, 0, 0, 0),
  ('plus', 'Plus', 'Surveillance hybride, recherche Web quotidienne et alertes e-mail.', 599, 72, 20,
   20, 3, 360, 1440,
   true, true, 90, false, false, 120,
   0, 0, 60, 0, 120, false, false,
   3, 1, 0, 3),
  ('pro', 'Pro', 'Pour les usages intensifs : 100 surveillances, historique avancé et exports.', 1499, 72, 30,
   100, 15, 120, 720,
   true, true, 365, true, true, 1000,
   0, 0, 60, 0, 120, false, false,
   3, 1, 0, 3),
  ('business', 'Business', 'Toutes les fonctions Pro + la surveillance de votre site professionnel.', 3999, 72, 40,
   100, 15, 120, 720,
   true, true, 365, true, true, 1000,
   1, 3, 60, 1, 120, true, true,
   3, 1, 1, 3)
on conflict (id) do nothing;

insert into public.plan_addons (id, name, price_cents, requires_plan_id, grants_business_sites)
values ('business_extra_site', 'Site professionnel supplémentaire', 1499, 'business', 1)
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
