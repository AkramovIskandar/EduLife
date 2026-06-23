-- EduLife: Complete Database Update for Full Progress Tracking
-- Run this in Supabase SQL Editor

-- 1. Add level field to student_accounts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'student_accounts' 
        AND column_name = 'level'
    ) THEN
        ALTER TABLE public.student_accounts 
        ADD COLUMN level text CHECK (level IN ('beginner', 'elementary', 'preintermediate'));
    END IF;
END $$;

-- 2. Create student_progress table for tracking completion
CREATE TABLE IF NOT EXISTS public.student_progress (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_username text NOT NULL,
    level text NOT NULL CHECK (level IN ('beginner', 'elementary', 'preintermediate')),
    test_key text NOT NULL,
    test_name text,
    completed boolean DEFAULT false,
    score numeric,
    percentage numeric,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(student_username, level, test_key)
);

-- 3. Add more detailed fields to submissions table for test history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'test_key'
    ) THEN
        ALTER TABLE public.submissions 
        ADD COLUMN test_key text;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'level'
    ) THEN
        ALTER TABLE public.submissions 
        ADD COLUMN level text CHECK (level IN ('beginner', 'elementary', 'preintermediate'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'percentage'
    ) THEN
        ALTER TABLE public.submissions 
        ADD COLUMN percentage numeric;
    END IF;
END $$;

-- 4. Update verify_student_login function to return level
CREATE OR REPLACE FUNCTION public.verify_student_login(p_username text, p_password text)
RETURNS TABLE(username text, display_name text, role text, level text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT sa.username, sa.display_name, coalesce(sa.role, 'student'), sa.level
    FROM public.student_accounts sa
    WHERE lower(trim(sa.username)) = lower(trim(p_username))
    AND sa.password_hash IS NOT NULL
    AND sa.password_hash = crypt(p_password, sa.password_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_student_login(text, text) TO anon, authenticated;

-- 5. Create function to get student progress
CREATE OR REPLACE FUNCTION public.get_student_progress(p_username text, p_level text)
RETURNS TABLE(
    total_tests int,
    completed_tests int,
    progress_percentage numeric,
    avg_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        15 as total_tests,
        COUNT(CASE WHEN sp.completed = true THEN 1 END)::int as completed_tests,
        ROUND((COUNT(CASE WHEN sp.completed = true THEN 1 END)::numeric / 15) * 100, 1) as progress_percentage,
        ROUND(AVG(CASE WHEN sp.percentage IS NOT NULL THEN sp.percentage END), 1) as avg_score
    FROM public.student_progress sp
    WHERE sp.student_username = p_username 
    AND sp.level = p_level;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_progress(text, text) TO anon, authenticated;

-- 6. Create function to get completed tests list
CREATE OR REPLACE FUNCTION public.get_completed_tests(p_username text, p_level text)
RETURNS TABLE(test_key text, test_name text, score numeric, percentage numeric, completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT sp.test_key, sp.test_name, sp.score, sp.percentage, sp.completed_at
    FROM public.student_progress sp
    WHERE sp.student_username = p_username 
    AND sp.level = p_level
    AND sp.completed = true
    ORDER BY sp.completed_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_completed_tests(text, text) TO anon, authenticated;

-- Enable RLS for new tables
ALTER TABLE public.student_progress enable row level security;
CREATE POLICY "anon can all student_progress" ON public.student_progress
    FOR ALL USING (true) WITH CHECK (true);

-- Insert initial test definitions for all levels
-- We define 15 tests per level
DO $$
BEGIN
    -- Test definitions will be handled by the application
    NULL;
END $$;

