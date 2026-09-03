-- =============================================================================
-- Migration: Add avatar_url and profile_pic_url columns to public.profiles table
-- =============================================================================

-- 1. Add avatar_url column if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'profile_pic_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN profile_pic_url TEXT DEFAULT NULL;
    END IF;
END $$;
