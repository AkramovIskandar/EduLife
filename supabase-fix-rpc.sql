-- 1. Barcha eski versiyalarni majburan o'chirib tashlaymiz
drop function if exists public.create_student_account(text, text, text);
drop function if exists public.create_student_account(text, text, text, text);

-- 2. Yangi va to'g'ri funksiyani yaratamiz
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

-- 3. Ruxsatlarni beramiz
grant execute on function public.create_student_account(text, text, text, text) to anon, authenticated, service_role;

-- 4. Keshni majburan tozalaymiz
NOTIFY pgrst, 'reload schema';
