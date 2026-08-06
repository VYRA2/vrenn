create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('termos','privacidade')),
  version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'signup',
  unique(user_id, document_type, version)
);
alter table public.legal_acceptances enable row level security;
create policy legal_acceptances_own_read on public.legal_acceptances for select using (auth.uid()=user_id);
create policy legal_acceptances_own_insert on public.legal_acceptances for insert with check (auth.uid()=user_id);
grant select, insert on public.legal_acceptances to authenticated;

create or replace function public.record_current_legal_acceptance()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v text := '2026-08-05';
begin
 if auth.uid() is null then raise exception 'Não autorizado'; end if;
 insert into legal_acceptances(user_id,document_type,version) values(auth.uid(),'termos',v) on conflict do nothing;
 insert into legal_acceptances(user_id,document_type,version) values(auth.uid(),'privacidade',v) on conflict do nothing;
 return jsonb_build_object('recorded',true,'version',v);
end; $$;
grant execute on function public.record_current_legal_acceptance() to authenticated;

create or replace function public.capture_signup_legal_acceptance()
returns trigger language plpgsql security definer set search_path=public as $$
declare v text;
begin
  v := new.raw_user_meta_data->>'legal_version';
  if v is not null and new.raw_user_meta_data->>'legal_accepted_at' is not null then
    insert into legal_acceptances(user_id,document_type,version,accepted_at,source)
    values(new.id,'termos',v,(new.raw_user_meta_data->>'legal_accepted_at')::timestamptz,'signup') on conflict do nothing;
    insert into legal_acceptances(user_id,document_type,version,accepted_at,source)
    values(new.id,'privacidade',v,(new.raw_user_meta_data->>'legal_accepted_at')::timestamptz,'signup') on conflict do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists on_auth_user_capture_legal_acceptance on auth.users;
create trigger on_auth_user_capture_legal_acceptance after insert on auth.users for each row execute function public.capture_signup_legal_acceptance();
