-- Run this ONCE in Supabase SQL Editor for shared Admin -> Customer website settings.
create table if not exists public.site_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_config enable row level security;

drop policy if exists "site_config_public_read" on public.site_config;
drop policy if exists "site_config_public_write" on public.site_config;

create policy "site_config_public_read"
on public.site_config for select
to anon, authenticated
using (true);

create policy "site_config_public_write"
on public.site_config for insert
to anon, authenticated
with check (true);

create policy "site_config_public_update"
on public.site_config for update
to anon, authenticated
using (true) with check (true);

insert into public.site_config (id, config) values ('main', '{}'::jsonb)
on conflict (id) do nothing;
