-- Comunidades publicas por nicho, independentes de equipes.
create table if not exists public.comunidades (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  nome text not null check (char_length(nome) between 2 and 60),
  descricao text,
  categoria text not null,
  avatar_url text,
  capa_url text,
  regras text,
  criador_id uuid not null references auth.users(id) on delete restrict,
  destaque boolean not null default false,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comunidade_membros (
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('membro','moderador','admin','owner')),
  status text not null default 'ativo' check (status in ('ativo','saiu','removido','banido')),
  entrou_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comunidade_id, user_id)
);

create table if not exists public.comunidade_posts (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  texto text check (char_length(texto) <= 2000),
  media_url text,
  post_id uuid references public.posts(id) on delete set null,
  status text not null default 'publicado' check (status in ('publicado','oculto','removido')),
  created_at timestamptz not null default now()
);

create table if not exists public.comunidade_desafios (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  titulo text not null,
  descricao text,
  regras text,
  tipo_validacao text not null check (tipo_validacao in ('strava','qr_code','geolocalizacao','foto_arbitro')),
  data_inicio date not null,
  data_fim date not null check (data_fim >= data_inicio),
  status text not null default 'agendado' check (status in ('agendado','ativo','encerrado','cancelado')),
  criado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.comunidade_desafio_participantes (
  desafio_id uuid not null references public.comunidade_desafios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progresso numeric not null default 0 check (progresso >= 0),
  status text not null default 'participando' check (status in ('participando','concluido','eliminado','desistiu')),
  entrou_em timestamptz not null default now(),
  primary key (desafio_id, user_id)
);

create table if not exists public.comunidade_denuncias (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references public.comunidades(id) on delete cascade,
  denunciante_id uuid not null references auth.users(id) on delete cascade,
  alvo_user_id uuid references auth.users(id) on delete set null,
  post_id uuid references public.comunidade_posts(id) on delete set null,
  motivo text not null,
  detalhes text,
  status text not null default 'aberta' check (status in ('aberta','em_analise','resolvida','arquivada')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.equipes add column if not exists comunidade_id uuid references public.comunidades(id) on delete set null;
alter table public.comunidades enable row level security;
alter table public.comunidade_membros enable row level security;
alter table public.comunidade_posts enable row level security;
alter table public.comunidade_desafios enable row level security;
alter table public.comunidade_desafio_participantes enable row level security;
alter table public.comunidade_denuncias enable row level security;

create or replace function public.is_comunidade_moderador(p_comunidade_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.comunidade_membros
    where comunidade_id = p_comunidade_id and user_id = p_user_id
      and status = 'ativo' and papel in ('moderador','admin','owner')
  );
$$;

drop policy if exists comunidades_public_read on public.comunidades;
create policy comunidades_public_read on public.comunidades for select using (ativa or public.is_comunidade_moderador(id));
drop policy if exists comunidades_admin_write on public.comunidades;
create policy comunidades_admin_write on public.comunidades for all using (public.is_comunidade_moderador(id)) with check (public.is_comunidade_moderador(id));

drop policy if exists comunidade_membros_read on public.comunidade_membros;
create policy comunidade_membros_read on public.comunidade_membros for select using (true);
drop policy if exists comunidade_membros_join on public.comunidade_membros;
create policy comunidade_membros_join on public.comunidade_membros for insert with check (auth.uid() = user_id and papel = 'membro' and status = 'ativo');
drop policy if exists comunidade_membros_update on public.comunidade_membros;
create policy comunidade_membros_update on public.comunidade_membros for update using (auth.uid() = user_id or public.is_comunidade_moderador(comunidade_id));
drop policy if exists comunidade_membros_delete on public.comunidade_membros;
create policy comunidade_membros_delete on public.comunidade_membros for delete using (auth.uid() = user_id or public.is_comunidade_moderador(comunidade_id));

drop policy if exists comunidade_posts_read on public.comunidade_posts;
create policy comunidade_posts_read on public.comunidade_posts for select using (status = 'publicado' or auth.uid() = user_id or public.is_comunidade_moderador(comunidade_id));
drop policy if exists comunidade_posts_insert on public.comunidade_posts;
create policy comunidade_posts_insert on public.comunidade_posts for insert with check (
  auth.uid() = user_id and exists(select 1 from public.comunidade_membros m where m.comunidade_id = comunidade_posts.comunidade_id and m.user_id = auth.uid() and m.status='ativo')
);
drop policy if exists comunidade_posts_update on public.comunidade_posts;
create policy comunidade_posts_update on public.comunidade_posts for update using (auth.uid() = user_id or public.is_comunidade_moderador(comunidade_id));

drop policy if exists comunidade_desafios_read on public.comunidade_desafios;
create policy comunidade_desafios_read on public.comunidade_desafios for select using (true);
drop policy if exists comunidade_desafios_write on public.comunidade_desafios;
create policy comunidade_desafios_write on public.comunidade_desafios for all using (public.is_comunidade_moderador(comunidade_id)) with check (public.is_comunidade_moderador(comunidade_id));

drop policy if exists comunidade_participantes_read on public.comunidade_desafio_participantes;
create policy comunidade_participantes_read on public.comunidade_desafio_participantes for select using (true);
drop policy if exists comunidade_participantes_join on public.comunidade_desafio_participantes;
create policy comunidade_participantes_join on public.comunidade_desafio_participantes for insert with check (auth.uid() = user_id);
drop policy if exists comunidade_denuncias_insert on public.comunidade_denuncias;
create policy comunidade_denuncias_insert on public.comunidade_denuncias for insert with check (auth.uid() = denunciante_id);
drop policy if exists comunidade_denuncias_read on public.comunidade_denuncias;
create policy comunidade_denuncias_read on public.comunidade_denuncias for select using (auth.uid() = denunciante_id or public.is_comunidade_moderador(comunidade_id));

create index if not exists idx_comunidades_categoria on public.comunidades(categoria) where ativa;
create index if not exists idx_comunidade_posts_feed on public.comunidade_posts(comunidade_id, created_at desc) where status='publicado';
create index if not exists idx_comunidade_desafios_status on public.comunidade_desafios(comunidade_id, status, data_inicio);

create or replace function public.join_comunidade(p_comunidade_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autorizado'; end if;
  if not exists(select 1 from comunidades where id=p_comunidade_id and ativa) then raise exception 'Comunidade indisponível'; end if;
  insert into comunidade_membros(comunidade_id,user_id,papel,status)
  values(p_comunidade_id,auth.uid(),'membro','ativo')
  on conflict(comunidade_id,user_id) do update set status='ativo', updated_at=now()
  where comunidade_membros.status <> 'banido';
  if exists(select 1 from comunidade_membros where comunidade_id=p_comunidade_id and user_id=auth.uid() and status='banido') then
    raise exception 'Participação bloqueada';
  end if;
  return jsonb_build_object('entrou',true);
end; $$;

grant select on public.comunidades, public.comunidade_membros, public.comunidade_posts, public.comunidade_desafios, public.comunidade_desafio_participantes to authenticated;
grant insert, update, delete on public.comunidade_membros, public.comunidade_posts, public.comunidade_desafio_participantes to authenticated;
grant insert, select on public.comunidade_denuncias to authenticated;
grant execute on function public.join_comunidade(uuid), public.is_comunidade_moderador(uuid,uuid) to authenticated;
