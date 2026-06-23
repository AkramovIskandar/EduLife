-- EduLife: yangi Supabase loyihada bir marta ishga tushiring (SQL Editor → Run)

create table if not exists public.student_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  display_name text,
  role text default 'student',
  created_at timestamptz default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_name text,
  student_username text,
  test_type text,
  score numeric default 0,
  group_name text,
  phone text,
  raw_answers jsonb default '{}',
  section_completion jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists public.test_settings (
  test_key text primary key,
  is_enabled boolean default true
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  full_name text,
  role text default 'student'
);

alter table public.student_accounts enable row level security;
alter table public.submissions enable row level security;
alter table public.test_settings enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "anon read student_accounts" on public.student_accounts;
drop policy if exists "anon insert student_accounts" on public.student_accounts;
drop policy if exists "anon update student_accounts" on public.student_accounts;
drop policy if exists "anon delete student_accounts" on public.student_accounts;
drop policy if exists "anon read submissions" on public.submissions;
drop policy if exists "anon insert submissions" on public.submissions;
drop policy if exists "anon delete submissions" on public.submissions;
drop policy if exists "anon read test_settings" on public.test_settings;
drop policy if exists "anon upsert test_settings" on public.test_settings;
drop policy if exists "anon read profiles" on public.profiles;
drop policy if exists "deny anon student_accounts" on public.student_accounts;
drop policy if exists "deny anon profiles" on public.profiles;

create policy "anon read student_accounts" on public.student_accounts for select to anon using (true);
create policy "anon insert student_accounts" on public.student_accounts for insert to anon with check (true);
create policy "anon update student_accounts" on public.student_accounts for update to anon using (true);
create policy "anon delete student_accounts" on public.student_accounts for delete to anon using (true);
create policy "anon read submissions" on public.submissions for select to anon using (true);
create policy "anon insert submissions" on public.submissions for insert to anon with check (true);
create policy "anon delete submissions" on public.submissions for delete to anon using (true);
create policy "anon read test_settings" on public.test_settings for select to anon using (true);
create policy "anon upsert test_settings" on public.test_settings for all to anon using (true) with check (true);
create policy "anon read profiles" on public.profiles for select to anon using (true);

-- Demo o'quvchi (ixtiyoriy): parolni o'zingiz belgilang va hash qiling (supabase-security-migration.sql)
-- insert into public.student_accounts (username, password, display_name, role)
-- values ('demo', 'CHANGE_ME', 'Demo student', 'student')
-- on conflict (username) do nothing;

insert into public.test_settings (test_key, is_enabled) values
  ('final', true), ('progress1', true), ('progress2', true),
  ('unit_1', true), ('unit_2', true), ('unit_3', true), ('unit_4', true),
  ('unit_5', true), ('unit_6', true), ('unit_7', true), ('unit_8', true),
  ('unit_9', true), ('unit_10', true), ('unit_11', true), ('unit_12', true),
  ('elementary_unit_1', true), ('elementary_unit_2', true), ('elementary_unit_3', true),
  ('elementary_unit_4', true), ('elementary_unit_5', true), ('elementary_unit_6', true),
  ('elementary_unit_7', true), ('elementary_unit_8', true), ('elementary_unit_9', true),
  ('elementary_unit_10', true), ('elementary_unit_11', true), ('elementary_unit_12', true),
  ('elementary', true), ('elementary_progress_1', true), ('elementary_progress_2', true),
  ('preint_unit_1', true), ('preint_unit_2', true), ('preint_unit_3', true), ('preint_unit_4', true),
  ('preint_unit_5', true), ('preint_unit_6', true), ('preint_unit_7', true), ('preint_unit_8', true),
  ('preint_unit_9', true), ('preint_unit_10', true), ('preint_unit_11', true), ('preint_unit_12', true),
  ('preint_progress_1', true), ('preint_progress_2', true), ('preint', true)
on conflict (test_key) do update set is_enabled = true;
