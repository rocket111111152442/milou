alter table public.agent_devices
  drop constraint agent_devices_platform_check,
  add constraint agent_devices_platform_check check (platform in ('windows', 'macos', 'linux', 'chrome'));

alter table public.agent_link_requests
  drop constraint agent_link_requests_platform_check,
  add constraint agent_link_requests_platform_check check (platform in ('windows', 'macos', 'linux', 'chrome'));

alter table public.monitoring_tasks
  drop constraint monitoring_tasks_execution_mode_check,
  add constraint monitoring_tasks_execution_mode_check check (execution_mode in ('auto', 'local_only', 'cloud_only', 'browser_only'));

-- Un ancien planificateur peut encore insérer un contrôle comme s’il était en mode automatique.
create function private.route_browser_only_job()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.monitoring_tasks
    where id = new.task_id and execution_mode = 'browser_only'
  ) then
    new.preferred_executor := 'agent';
    new.allow_cloud := false;
    new.allow_agent := true;
    new.agent_deadline_at := null;
  end if;
  return new;
end;
$$;

create trigger route_browser_only_job
before insert on public.monitoring_jobs
for each row execute function private.route_browser_only_job();
