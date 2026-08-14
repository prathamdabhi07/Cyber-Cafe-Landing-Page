-- =========================================================
-- KNOWLEDGE WORLD ONLINE — Supabase backend schema
-- ---------------------------------------------------------
-- Run this ONCE in your Supabase project's SQL Editor:
-- Project → SQL Editor → New query → paste this whole file → Run
-- =========================================================

-- needed for password hashing (crypt / gen_salt)
create extension if not exists pgcrypto;

-- ---------- sequence used to build human-readable tokens ----------
create sequence if not exists kwo_request_seq start 1;

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  mobile        text not null unique,
  email         text,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null
);

-- default admin account (same as the original demo credentials)
-- Username: admin   Password: KWO@2026
insert into public.admin_users (username, password_hash)
values ('admin', crypt('KWO@2026', gen_salt('bf')))
on conflict (username) do nothing;

create table if not exists public.requests (
  id          uuid primary key default gen_random_uuid(),
  token       text unique,
  user_id     uuid references public.customers(id) on delete set null,
  name        text not null,
  mobile      text not null,
  service     text not null,
  copies      int,
  print_type  text,
  notes       text,
  status      text not null default 'Pending',
  created_at  timestamptz not null default now()
);

create table if not exists public.request_files (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.requests(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  file_size    bigint,
  file_type    text,
  created_at   timestamptz not null default now()
);

-- ---------- auto-generate the KWO-YYYY-0000 token on insert ----------
create or replace function public.kwo_set_token()
returns trigger language plpgsql as $$
begin
  if new.token is null then
    new.token := 'KWO-' || extract(year from now())::int || '-' ||
                 lpad(nextval('kwo_request_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kwo_set_token on public.requests;
create trigger trg_kwo_set_token
before insert on public.requests
for each row execute function public.kwo_set_token();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
-- customers & admin_users: NO direct table access from the browser at all.
-- All reads/writes go through the SECURITY DEFINER functions below, so
-- password hashes are never exposed to the client.
alter table public.customers  enable row level security;
alter table public.admin_users enable row level security;

-- requests / request_files: readable & writable by anyone holding the
-- publishable (anon) key — same trust model as the original single-device
-- demo (counter PC), just shared across devices now. See SETUP_SUPABASE.md
-- for how to lock this down further if you need it.
alter table public.requests      enable row level security;
alter table public.request_files enable row level security;

drop policy if exists "public read requests" on public.requests;
create policy "public read requests" on public.requests for select using (true);
drop policy if exists "public insert requests" on public.requests;
create policy "public insert requests" on public.requests for insert with check (true);
drop policy if exists "public update requests" on public.requests;
create policy "public update requests" on public.requests for update using (true);
drop policy if exists "public delete requests" on public.requests;
create policy "public delete requests" on public.requests for delete using (true);

drop policy if exists "public read request_files" on public.request_files;
create policy "public read request_files" on public.request_files for select using (true);
drop policy if exists "public insert request_files" on public.request_files;
create policy "public insert request_files" on public.request_files for insert with check (true);
drop policy if exists "public delete request_files" on public.request_files;
create policy "public delete request_files" on public.request_files for delete using (true);

-- =========================================================
-- RPC FUNCTIONS (SECURITY DEFINER — run with owner rights,
-- so they can safely touch customers/admin_users under RLS)
-- =========================================================

create or replace function public.register_customer(
  p_name text, p_mobile text, p_email text, p_password text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_user public.customers;
begin
  if exists (select 1 from public.customers where mobile = p_mobile) then
    return json_build_object('ok', false, 'error', 'An account with this mobile number already exists.');
  end if;
  if p_email is not null and p_email <> '' and
     exists (select 1 from public.customers where lower(email) = lower(p_email)) then
    return json_build_object('ok', false, 'error', 'An account with this email already exists.');
  end if;

  insert into public.customers (name, mobile, email, password_hash)
  values (p_name, p_mobile, nullif(p_email, ''), crypt(p_password, gen_salt('bf')))
  returning * into v_user;

  return json_build_object('ok', true, 'user', json_build_object(
    'id', v_user.id, 'name', v_user.name, 'mobile', v_user.mobile,
    'email', v_user.email, 'createdAt', v_user.created_at
  ));
end;
$$;

create or replace function public.login_customer(
  p_mobile text, p_password text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_user public.customers;
begin
  select * into v_user from public.customers where mobile = p_mobile;
  if not found then
    return json_build_object('ok', false, 'error', 'No account found with this mobile number.');
  end if;
  if v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    return json_build_object('ok', false, 'error', 'Incorrect password. Please try again.');
  end if;
  return json_build_object('ok', true, 'user', json_build_object(
    'id', v_user.id, 'name', v_user.name, 'mobile', v_user.mobile,
    'email', v_user.email, 'createdAt', v_user.created_at
  ));
end;
$$;

create or replace function public.list_customers()
returns table(id uuid, name text, mobile text, email text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, name, mobile, email, created_at from public.customers order by created_at desc;
$$;

create or replace function public.login_admin(
  p_username text, p_password text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_admin public.admin_users;
begin
  select * into v_admin from public.admin_users where username = p_username;
  if not found then
    return json_build_object('ok', false, 'error', 'Invalid admin username or password.');
  end if;
  if v_admin.password_hash <> crypt(p_password, v_admin.password_hash) then
    return json_build_object('ok', false, 'error', 'Invalid admin username or password.');
  end if;
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.register_customer(text,text,text,text) to anon, authenticated;
grant execute on function public.login_customer(text,text)              to anon, authenticated;
grant execute on function public.list_customers()                       to anon, authenticated;
grant execute on function public.login_admin(text,text)                 to anon, authenticated;

-- =========================================================
-- STORAGE — bucket for uploaded PDF/JPG/PNG files
-- =========================================================
insert into storage.buckets (id, name, public)
values ('kwo-files', 'kwo-files', true)
on conflict (id) do nothing;

drop policy if exists "kwo-files public upload" on storage.objects;
create policy "kwo-files public upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'kwo-files');

drop policy if exists "kwo-files public read" on storage.objects;
create policy "kwo-files public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'kwo-files');

drop policy if exists "kwo-files public delete" on storage.objects;
create policy "kwo-files public delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'kwo-files');

-- =========================================================
-- DONE. Your database, auth logic and file storage are ready.
-- =========================================================
