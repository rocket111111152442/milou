-- WAVERTI — Row Level Security
--
-- Modèle :
--   * Toutes les tables ont la RLS activée.
--   * Le rôle app_user (lectures pour le compte d'un utilisateur) n'a AUCUN droit d'écriture :
--     toutes les écritures passent par l'API serveur, qui valide les quotas, les URL (SSRF)
--     et les droits d'abonnement avant d'écrire avec le rôle propriétaire.
--   * Le rôle app_user peut seulement LIRE ses propres lignes (défense en profondeur :
--     l'application exécute aussi ses lectures utilisateur sous ce rôle, cf. withUser()).
--   * Les tables d'exploitation (billing_events, api_usage, admin_audit_logs, caches,
--     worker_heartbeats, rate_limits, app_settings...) ne sont accessibles qu'au serveur.

-- 1. Activer la RLS partout dans public
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- 2. Le rôle app_user n'a aucun droit par défaut ; seuls les droits de LECTURE ci-dessous lui sont accordés.
revoke all on all tables in schema public from app_user;
revoke all on all sequences in schema public from app_user;
revoke all on all functions in schema public from app_user;
revoke all on schema private from app_user;
grant usage on schema public to app_user;

-- 3. Données publiques (formules, versions desktop publiées)
grant select on public.plans, public.plan_addons to app_user;
create policy plans_public_read on public.plans for select to app_user using (is_public);
create policy plan_addons_public_read on public.plan_addons for select to app_user using (is_public);
grant select on public.desktop_releases to app_user;
create policy desktop_releases_public_read on public.desktop_releases for select to app_user using (is_published);

grant select on public.profiles to app_user;
create policy profiles_self_read on public.profiles
  for select to app_user using (id = (select app.current_user_id()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'subscriptions', 'entitlements',
    'monitoring_tasks', 'monitoring_targets', 'monitoring_schedules', 'monitoring_jobs',
    'monitoring_results', 'monitoring_seen_items',
    'notifications',
    'business_sites', 'site_verifications', 'business_endpoints', 'business_checks',
    'business_daily_stats', 'browser_test_scenarios', 'browser_test_runs',
    'incidents', 'incident_events', 'artifacts',
    'support_tickets'
  ] loop
    execute format('grant select on public.%I to app_user', t);
    execute format(
      'create policy %I on public.%I for select to app_user using (user_id = (select app.current_user_id()))',
      t || '_owner_read', t
    );
  end loop;
end;
$$;

-- Messages de support : visibles si le ticket appartient à l'utilisateur
grant select on public.support_messages to app_user;
create policy support_messages_owner_read on public.support_messages
  for select to app_user using (
    exists (
      select 1 from public.support_tickets st
      where st.id = support_messages.ticket_id and st.user_id = (select app.current_user_id())
    )
  );

-- Appareils : lecture de ses appareils, SANS la colonne token_hash
grant select (
  id, user_id, name, platform, app_version, status, consent_local_at, consent_version,
  monitoring_enabled, last_seen_at, last_state, created_at, revoked_at
) on public.agent_devices to app_user;
create policy agent_devices_owner_read on public.agent_devices
  for select to app_user using (user_id = (select app.current_user_id()));

-- 5. Garde-fou supplémentaire : un rôle client ne peut jamais modifier un rôle ou une suspension,
--    même si un droit d'écriture était accordé par erreur dans une migration future.
create or replace function private.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'app_user' then
    if new.role is distinct from old.role
       or new.suspended_at is distinct from old.suspended_at
       or new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'forbidden: privileged profile fields are server-managed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function private.guard_profile_privileges();
