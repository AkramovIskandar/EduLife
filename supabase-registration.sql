-- =============================================
-- EduLife: RO'YXATDAN O'TISH TIZIMI
-- Bu SQL Supabase SQL Editor'da ishlatiladi
-- =============================================

-- 1. registration_requests jadvali
create table if not exists public.registration_requests (
    id uuid default gen_random_uuid() primary key,
    full_name text not null,
    phone text not null,
    note text default '',
    status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz default now()
);

-- 2. RLS yoqish
alter table public.registration_requests enable row level security;

-- 3. RLS siyosatlari — anon barcha amallar
create policy "anon all registration_requests"
    on public.registration_requests
    for all
    to anon
    using (true)
    with check (true);

-- 4. submit_registration funksiyasi
create or replace function public.submit_registration(
    p_full_name text,
    p_phone text,
    p_note text default ''
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_result json;
begin
    -- Telefon raqam bo'yicha dublikat pending arizani tekshirish
    if exists (
        select 1 from public.registration_requests
        where phone = trim(p_phone)
        and status = 'pending'
    ) then
        return json_build_object(
            'success', false,
            'message', 'Bu telefon raqam bilan ariza allaqachon yuborilgan. Iltimos, admin tasdiqlashini kuting.'
        );
    end if;

    insert into public.registration_requests (
        full_name,
        phone,
        note,
        status
    ) values (
        trim(p_full_name),
        trim(p_phone),
        coalesce(trim(p_note), ''),
        'pending'
    )
    returning json_build_object(
        'success', true,
        'id', id,
        'full_name', full_name,
        'phone', phone
    ) into v_result;

    return v_result;
end;
$$;

-- 5. Funksiyaga ruxsat berish
grant execute on function public.submit_registration(text, text, text) to anon, authenticated, service_role;

-- =============================================
-- TUGADI! Endi login.html'da ro'yxatdan o'tish ishlaydi.
-- =============================================
