-- Agar supabase-security-migration.sql ishlatilgan bo'lsa, oddiy rejimga qaytish uchun Run qiling.

alter table public.student_accounts add column if not exists password text;

drop policy if exists "deny anon student_accounts" on public.student_accounts;
drop policy if exists "anon insert submissions" on public.submissions;
drop policy if exists "anon read test_settings" on public.test_settings;
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

-- Demo o'quvchi (ixtiyoriy): parolni o'zingiz belgilang
-- insert into public.student_accounts (username, password, display_name, role)
-- values ('demo', 'CHANGE_ME', 'Demo student', 'student')
-- on conflict (username) do nothing;
