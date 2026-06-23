-- EduLife: Add student level field (Run in SQL Editor)

-- Add level column to student_accounts
alter table public.student_accounts
  add column if not exists level text check (level in ('beginner', 'elementary', 'preintermediate'));

-- Update verify_student_login function to return level
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

grant execute on function public.verify_student_login(text, text) to anon, authenticated;
