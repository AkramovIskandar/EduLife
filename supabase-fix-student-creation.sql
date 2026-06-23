-- EduLife: Complete Database Fix for Student Creation
-- Bu faylni Supabase SQL Editor'da bajarishingiz kerak!

-- 1. Kengaytirilgan student_accounts jadvali (level qo'shildi)
alter table public.student_accounts
  add column if not exists level text check (level in ('beginner', 'elementary', 'preintermediate'));

-- 2. Pgcrypto kengaytmasini yoqish (agar yo'q bo'lsa)
create extension if not exists pgcrypto;

-- 3. Yeni student yaratish uchun xavfsiz RPC funksiyasi
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
    -- Yangi studentni yaratish va parolni xeshlash
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

-- 4. Student account'ni yangilash uchun funksiyasi (parolni yangilash uchun)
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

-- 5. Verify_student_login funksiyasini yangilash (level qaytarish uchun)
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

-- 6. RLS siyosatlarini to'g'rilash (anon uchun kerakli ruxsatlar)
-- Eski taqiqiy siyosatlarni olib tashlash
drop policy if exists "deny anon student_accounts" on public.student_accounts;
drop policy if exists "deny anon profiles" on public.profiles;

-- Student_accounts uchun ochiq RLS (admin ishlatishi uchun)
create policy "anon all student_accounts"
    on public.student_accounts for all to anon
    using (true) with check (true);

-- Submissions uchun to'liq ruxsat
drop policy if exists "anon insert submissions" on public.submissions;
create policy "anon all submissions"
    on public.submissions for all to anon
    using (true) with check (true);

-- Test_settings uchun to'liq ruxsat
drop policy if exists "anon read test_settings" on public.test_settings;
create policy "anon all test_settings"
    on public.test_settings for all to anon
    using (true) with check (true);

-- Funksiyalar uchun ruxsatlar
revoke all on function public.create_student_account(text, text, text, text) from public;
grant execute on function public.create_student_account(text, text, text, text) to anon, authenticated;

revoke all on function public.update_student_account(uuid, text, text, text, text) from public;
grant execute on function public.update_student_account(uuid, text, text, text, text) to anon, authenticated;

revoke all on function public.verify_student_login(text, text) from public;
grant execute on function public.verify_student_login(text, text) to anon, authenticated;

-- Demo hisob yaratish (ixtiyoriy)
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

-- Eski plaintext password ustunini olib tashlash (agar kerak bo'lsa)
-- do $$
-- begin
--     if exists (
--         select 1 from information_schema.columns
--         where table_schema = 'public' and table_name = 'student_accounts' and column_name = 'password'
--     ) then
--         alter table public.student_accounts alter column password drop not null;
--         alter table public.student_accounts drop column password;
--     end if;
-- end $$;
