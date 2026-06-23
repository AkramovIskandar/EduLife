-- EduLife xavfsizlik migratsiyasi (mavjud loyihada SQL Editor → Run)
-- Eski ochiq RLS va plaintext parollarni almashtiradi.

create extension if not exists pgcrypto;

-- Parol xeshi (plaintext ustun keyinroq o'chiriladi)
alter table public.student_accounts
  add column if not exists password_hash text;

-- Mavjud plaintext parollarni xeshlash
update public.student_accounts
set password_hash = crypt(password, gen_salt('bf'))
where password_hash is null and password is not null and password <> '';

-- Login: faqat RPC orqali (parol klientga qaytmaydi)
create or replace function public.verify_student_login(p_username text, p_password text)
returns table(username text, display_name text, role text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select sa.username, sa.display_name, coalesce(sa.role, 'student')
  from public.student_accounts sa
  where lower(trim(sa.username)) = lower(trim(p_username))
    and sa.password_hash is not null
    and sa.password_hash = crypt(p_password, sa.password_hash);
end;
$$;

revoke all on function public.verify_student_login(text, text) from public;
grant execute on function public.verify_student_login(text, text) to anon, authenticated;

create or replace function public.hash_password(p_password text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select crypt(p_password, gen_salt('bf'));
$$;

grant execute on function public.hash_password(text) to service_role;

-- Ochiq RLS siyosatlarini olib tashlash
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

-- student_accounts: anon uchun to'liq taqiq (faqat service role / API)
create policy "deny anon student_accounts"
  on public.student_accounts for all to anon
  using (false) with check (false);

-- submissions: faqat yangi topshiruv yozish
create policy "anon insert submissions"
  on public.submissions for insert to anon
  with check (true);

-- test_settings: faqat o'qish (imtihon yoqilgan/yopilgan)
create policy "anon read test_settings"
  on public.test_settings for select to anon
  using (true);

-- profiles: taqiq (Supabase Auth ishlatilsa keyin qo'shiladi)
create policy "deny anon profiles"
  on public.profiles for all to anon
  using (false) with check (false);

-- test_settings kalitlarini SQL bilan moslashtirish (unit_1 format)
insert into public.test_settings (test_key, is_enabled) values
  ('unit_1', true), ('unit_2', true), ('unit_3', true), ('unit_4', true),
  ('unit_5', true), ('unit_6', true), ('unit_7', true), ('unit_8', true),
  ('unit_9', true), ('unit_10', true), ('unit_11', true), ('unit_12', true)
on conflict (test_key) do nothing;

-- Eski noto'g'ri kalitlarni o'chirish (ixtiyoriy)
delete from public.test_settings where test_key ~ '^unit[0-9]+$' and test_key not like 'unit_%';

-- Eski plaintext ustun (mavjud loyihalar uchun)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_accounts' and column_name = 'password'
  ) then
    alter table public.student_accounts alter column password drop not null;
    alter table public.student_accounts drop column password;
  end if;
end $$;
