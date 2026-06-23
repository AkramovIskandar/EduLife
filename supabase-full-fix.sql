-- EduLife: FULL FIX - To'liq Database Konfiguratsiyasi
-- Bu faylni Supabase SQL Editor'da bajarishingiz kerak!
-- Bu fayl oldingi funksiyalarni o'chirib, yangilarini yaratadi

-- ===========================================
-- 1. KERAKLI KENGAYTMALARNI YOQISH
-- ===========================================
create extension if not exists pgcrypto;

-- ===========================================
-- 2. ESKI FUNKSIYALARNI O'CHIRISH (AVVAL)
-- ===========================================
drop function if exists public.create_student_account(text, text, text, text);
drop function if exists public.update_student_account(uuid, text, text, text, text);
drop function if exists public.verify_student_login(text, text);
drop function if exists public.get_student_progress(text, text);
drop function if exists public.get_completed_tests(text, text);

-- ===========================================
-- 3. STUDENT_ACCOUNTS JADVALINI YANGILASH
-- ===========================================
alter table public.student_accounts
  add column if not exists level text check (level in ('beginner', 'elementary', 'preintermediate'));

-- ===========================================
-- 4. STUDENT_PROGRESS JADVALINI YARATISH
-- ===========================================
create table if not exists public.student_progress (
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

-- ===========================================
-- 5. SUBMISSIONS JADVALINI YANGILASH
-- ===========================================
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'submissions' 
        and column_name = 'test_key'
    ) then
        alter table public.submissions 
        add column test_key text;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'submissions' 
        and column_name = 'level'
    ) then
        alter table public.submissions 
        add column level text check (level in ('beginner', 'elementary', 'preintermediate'));
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'submissions' 
        and column_name = 'percentage'
    ) then
        alter table public.submissions 
        add column percentage numeric;
    end if;
end $$;

-- ===========================================
-- 6. YANGI STUDENT YARATISH FUNKSIYASI
-- ===========================================
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
        p_username,
        crypt(p_password, gen_salt('bf')),
        p_display_name,
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

-- ===========================================
-- 7. STUDENTNI YANGILASH FUNKSIYASI
-- ===========================================
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
        username = p_username,
        display_name = p_display_name,
        level = p_level,
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

-- ===========================================
-- 8. STUDENT LOGIN TEKSHIRISH FUNKSIYASI
-- ===========================================
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

-- ===========================================
-- 9. STUDENT PROGRESSINI OLISH FUNKSIYASI
-- ===========================================
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

-- ===========================================
-- 10. TUGALLANGAN TESTLARNI OLISH FUNKSIYASI
-- ===========================================
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
-- 11. RLS (Row Level Security) SIYOSATLARI
-- ===========================================
-- Eski siyosatlarni olib tashlash
drop policy if exists "deny anon student_accounts" on public.student_accounts;
drop policy if exists "deny anon profiles" on public.profiles;
drop policy if exists "anon insert submissions" on public.submissions;
drop policy if exists "anon read test_settings" on public.test_settings;

-- Student_accounts uchun ochiq RLS
create policy "anon all student_accounts"
    on public.student_accounts for all to anon
    using (true) with check (true);

-- Submissions uchun to'liq ruxsat
create policy "anon all submissions"
    on public.submissions for all to anon
    using (true) with check (true);

-- Test_settings uchun to'liq ruxsat
create policy "anon all test_settings"
    on public.test_settings for all to anon
    using (true) with check (true);

-- Student_progress uchun RLS yoqish va ochiq siyosat
alter table public.student_progress enable row level security;
create policy "anon all student_progress" on public.student_progress
    for all using (true) with check (true);

-- ===========================================
-- 12. FUNKSIYALAR UCHUN RUXSATLAR
-- ===========================================
grant execute on function public.create_student_account(text, text, text, text) to anon, authenticated;
grant execute on function public.update_student_account(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.verify_student_login(text, text) to anon, authenticated;
grant execute on function public.get_student_progress(text, text) to anon, authenticated;
grant execute on function public.get_completed_tests(text, text) to anon, authenticated;

-- ===========================================
-- 13. DEMO HISOB YARATISH (IXTIYORIY)
-- ===========================================
do $$
begin
    if not exists (select 1 from public.student_accounts where username = 'demo') then
        insert into public.student_accounts (
            username,
            password_hash,
            display_name,
            role,
            level
        ) values (
            'demo',
            crypt('demo123', gen_salt('bf')),
            'Demo Student',
            'student',
            'beginner'
        );
    end if;
end $$;

-- ===========================================
-- TUGADI! BARCHA NARSALAR TO'G'RI ISHLASHI KERAK
-- ===========================================
