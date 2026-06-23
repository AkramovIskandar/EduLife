-- EduLife: BOSHLANG'ICHDAN TO'LIQ DATABASE YARATISH
-- Bu SQL siz tozalagan Supabase database'ga hammasini boshidan to'g'ri yaratadi.
-- SQL Editor'da barcha kodni tanlab "Run" tugmasini bosing.

-- ===========================================
-- 1. KERAKLI KENGAYTMALARNI YOQISH
-- ===========================================
create extension if not exists pgcrypto;

-- ===========================================
-- 2. ESKI JADVALLARNI TOZALASH (Ixtiyoriy/Toza boshlash uchun)
-- ===========================================
drop table if exists public.profiles cascade;
drop table if exists public.student_progress cascade;
drop table if exists public.submissions cascade;
drop table if exists public.student_accounts cascade;
drop table if exists public.test_settings cascade;

-- ===========================================
-- 3. JADVALLARNI YARATISH
-- ===========================================

-- student_accounts jadvali
create table public.student_accounts (
    id uuid default gen_random_uuid() primary key,
    username text unique not null,
    password_hash text not null,
    display_name text not null,
    role text default 'student' check (role in ('student', 'admin')),
    level text default 'beginner' check (level in ('beginner', 'elementary', 'preintermediate')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- submissions jadvali
create table public.submissions (
    id uuid default gen_random_uuid() primary key,
    student_name text,
    student_username text not null,
    test_type text,
    test_key text,
    level text check (level in ('beginner', 'elementary', 'preintermediate')),
    score numeric default 0,
    percentage numeric default 0,
    group_name text,
    phone text,
    section_completion jsonb default '{}',
    raw_answers jsonb default '{}',
    created_at timestamptz default now()
);

-- student_progress jadvali
create table public.student_progress (
    id uuid default gen_random_uuid() primary key,
    student_username text not null,
    level text not null check (level in ('beginner', 'elementary', 'preintermediate')),
    test_key text not null,
    test_name text,
    completed boolean default false,
    score numeric,
    percentage numeric,
    completed_at timestamptz,
    created_at timestamptz default now(),
    unique(student_username, level, test_key)
);

-- test_settings jadvali
create table public.test_settings (
    test_key text primary key,
    is_enabled boolean default true,
    created_at timestamptz default now()
);

-- profiles jadvali
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    username text,
    full_name text,
    role text default 'student'
);

-- ===========================================
-- 4. FUNKSIYALAR VA RPC LARNI YARATISH
-- ===========================================

-- 4.1. Parolni xeshlash funksiyasi (hash_password)
create or replace function public.hash_password(p_password text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select crypt(p_password, gen_salt('bf'));
$$;

-- 4.2. O'quvchi yaratish funksiyasi (create_student_account)
create or replace function public.create_student_account(
    p_username text,
    p_password text,
    p_display_name text,
    p_level text default 'beginner'
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_result json;
begin
    insert into public.student_accounts (
        username,
        password_hash,
        display_name,
        role,
        level
    ) values (
        lower(trim(p_username)),
        crypt(p_password, gen_salt('bf')),
        trim(p_display_name),
        'student',
        p_level
    )
    on conflict (username) do nothing
    returning json_build_object(
        'success', true,
        'username', username,
        'display_name', display_name,
        'level', level
    ) into v_result;

    if v_result is null then
        return json_build_object(
            'success', false,
            'message', 'Username already exists'
        );
    end if;

    return v_result;
end;
$$;

-- 4.3. O'quvchini yangilash funksiyasi (update_student_account)
create or replace function public.update_student_account(
    p_id uuid,
    p_username text,
    p_password text,
    p_display_name text,
    p_level text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_result json;
begin
    update public.student_accounts
    set
        username = lower(trim(p_username)),
        display_name = trim(p_display_name),
        level = p_level,
        updated_at = now(),
        password_hash = case
            when p_password is not null and p_password <> ''
            then crypt(p_password, gen_salt('bf'))
            else password_hash
        end
    where id = p_id
    returning json_build_object(
        'success', true,
        'id', id,
        'username', username,
        'display_name', display_name,
        'level', level
    ) into v_result;

    if v_result is null then
        return json_build_object(
            'success', false,
            'message', 'Student not found'
        );
    end if;

    return v_result;
end;
$$;

-- 4.4. Login tekshirish funksiyasi (verify_student_login)
create or replace function public.verify_student_login(p_username text, p_password text)
returns table(username text, display_name text, role text, level text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    return query
    select sa.username, sa.display_name, coalesce(sa.role, 'student'), sa.level
    from public.student_accounts sa
    where lower(trim(sa.username)) = lower(trim(p_username))
        and sa.password_hash is not null
        and sa.password_hash = crypt(p_password, sa.password_hash);
end;
$$;

-- 4.5. Student progressini olish (get_student_progress)
create or replace function public.get_student_progress(p_username text, p_level text)
returns table(
    total_tests int,
    completed_tests int,
    progress_percentage numeric,
    avg_score numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    return query
    select 
        15 as total_tests,
        count(case when sp.completed = true then 1 end)::int as completed_tests,
        round((count(case when sp.completed = true then 1 end)::numeric / 15) * 100, 1) as progress_percentage,
        round(avg(case when sp.percentage is not null then sp.percentage end), 1) as avg_score
    from public.student_progress sp
    where sp.student_username = p_username 
    and sp.level = p_level;
end;
$$;

-- 4.6. Tugallangan testlarni olish (get_completed_tests)
create or replace function public.get_completed_tests(p_username text, p_level text)
returns table(test_key text, test_name text, score numeric, percentage numeric, completed_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    return query
    select sp.test_key, sp.test_name, sp.score, sp.percentage, sp.completed_at
    from public.student_progress sp
    where sp.student_username = p_username 
    and sp.level = p_level
    and sp.completed = true
    order by sp.completed_at desc;
end;
$$;

-- ===========================================
-- 5. RLS (ROW LEVEL SECURITY) FAOLLASHTIRISH
-- ===========================================
alter table public.student_accounts enable row level security;
alter table public.submissions enable row level security;
alter table public.student_progress enable row level security;
alter table public.test_settings enable row level security;
alter table public.profiles enable row level security;

-- Ochiq RLS siyosatlari (client to'g'ridan-to'g'ri ishlashi uchun)
create policy "anon all student_accounts" on public.student_accounts for all to anon using (true) with check (true);
create policy "anon all submissions" on public.submissions for all to anon using (true) with check (true);
create policy "anon all student_progress" on public.student_progress for all to anon using (true) with check (true);
create policy "anon all test_settings" on public.test_settings for all to anon using (true) with check (true);
create policy "anon all profiles" on public.profiles for all to anon using (true) with check (true);

-- ===========================================
-- 6. FUNKSIYALAR UCHUN RUXSATLAR (EXECUTE GRANTS)
-- ===========================================
grant execute on function public.hash_password(text) to anon, authenticated, service_role;
grant execute on function public.create_student_account(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.update_student_account(uuid, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.verify_student_login(text, text) to anon, authenticated, service_role;
grant execute on function public.get_student_progress(text, text) to anon, authenticated, service_role;
grant execute on function public.get_completed_tests(text, text) to anon, authenticated, service_role;

-- ===========================================
-- 7. BOSHLANG'ICH MA'LUMOTLARNI YUKLASH (SEED DATA)
-- ===========================================

-- 7.1. Barcha test sozlamalarini kiritish (hammasi faol)
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

-- 7.2. Demo o'quvchi hisobini yaratish (demo / demo123)
insert into public.student_accounts (username, password_hash, display_name, role, level)
values ('demo', crypt('demo123', gen_salt('bf')), 'Demo Student', 'student', 'beginner')
on conflict (username) do nothing;

-- 7.3. Admin hisobini yaratish (admin / admin123)
insert into public.student_accounts (username, password_hash, display_name, role, level)
values ('admin', crypt('admin123', gen_salt('bf')), 'Administrator', 'admin', 'beginner')
on conflict (username) do nothing;

-- ===========================================
-- TUGADI! Barcha jadvallar va bog'lanishlar yaratildi.
-- ===========================================
