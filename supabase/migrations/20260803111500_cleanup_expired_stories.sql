-- Limpeza completa de stories: remove registros vencidos e arquivos do Storage.

create table if not exists public.story_storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  story_id uuid,
  object_path text not null,
  queued_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create unique index if not exists story_storage_cleanup_queue_pending_path_key
  on public.story_storage_cleanup_queue (object_path)
  where processed_at is null;

alter table public.story_storage_cleanup_queue enable row level security;
revoke all on public.story_storage_cleanup_queue from anon, authenticated;

create table if not exists public.system_maintenance_state (
  task text primary key,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_result jsonb,
  updated_at timestamptz not null default now()
);

alter table public.system_maintenance_state enable row level security;
revoke all on public.system_maintenance_state from anon, authenticated;

insert into public.system_maintenance_state (task)
values ('cleanup_expired_stories')
on conflict (task) do nothing;

create or replace function public.queue_story_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.media_url is not null and btrim(old.media_url) <> '' then
    insert into public.story_storage_cleanup_queue (story_id, object_path)
    values (old.id, old.media_url)
    on conflict (object_path) where processed_at is null do nothing;
  end if;

  return old;
end;
$$;

revoke all on function public.queue_story_storage_cleanup() from public, anon, authenticated;

drop trigger if exists trg_queue_story_storage_cleanup on public.stories;
create trigger trg_queue_story_storage_cleanup
before delete on public.stories
for each row
execute function public.queue_story_storage_cleanup();

create or replace function public.claim_story_cleanup_run(min_interval_seconds integer default 300)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_start timestamptz;
begin
  if not pg_try_advisory_xact_lock(hashtext('cleanup_expired_stories')) then
    return false;
  end if;

  select last_started_at
    into previous_start
  from public.system_maintenance_state
  where task = 'cleanup_expired_stories'
  for update;

  if previous_start is not null
     and previous_start > now() - make_interval(secs => greatest(min_interval_seconds, 60)) then
    return false;
  end if;

  update public.system_maintenance_state
  set last_started_at = now(), updated_at = now()
  where task = 'cleanup_expired_stories';

  return true;
end;
$$;

revoke all on function public.claim_story_cleanup_run(integer) from public, anon, authenticated;
grant execute on function public.claim_story_cleanup_run(integer) to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'vrenn-cleanup-expired-stories';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'vrenn-cleanup-expired-stories',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://pitgdiekkshtrvlkdnvg.supabase.co/functions/v1/cleanup-expired-stories',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_WKygjpu9wiB4aRJCpSMPMA_SV98Lvh0',
        'Authorization', 'Bearer sb_publishable_WKygjpu9wiB4aRJCpSMPMA_SV98Lvh0',
        'x-cleanup-source', 'pg_cron'
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

comment on table public.story_storage_cleanup_queue is
  'Fila interna de arquivos de stories que precisam ser removidos do Storage.';
