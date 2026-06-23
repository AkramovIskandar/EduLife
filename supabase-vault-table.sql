-- Hidden backup table for test results + writing (admin recovery only)
-- Run once in Supabase SQL Editor

create table if not exists submissions_vault (
    id uuid primary key default gen_random_uuid(),
    vault_id text unique not null,
    student_name text,
    student_username text,
    test_type text,
    test_key text,
    level text,
    score numeric,
    percentage numeric,
    group_name text,
    phone text,
    writing_text text,
    speaking_text text,
    section_completion jsonb default '{}'::jsonb,
    raw_answers jsonb default '{}'::jsonb,
    payload jsonb default '{}'::jsonb,
    saved_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_submissions_vault_username on submissions_vault(student_username);
create index if not exists idx_submissions_vault_saved_at on submissions_vault(saved_at desc);

alter table submissions_vault enable row level security;

-- No public policies — only service role (API) can read/write
