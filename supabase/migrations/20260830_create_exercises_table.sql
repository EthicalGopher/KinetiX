-- Migration: Create public.exercises table and seed Squats exercise data
-- Adheres to Supabase Postgres Best Practices with RLS and proper indexing

CREATE TABLE IF NOT EXISTS public.exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('strength', 'cardio', 'flexibility')),
    icon TEXT NOT NULL DEFAULT '🏋️',
    description TEXT DEFAULT '',
    bg_gradient TEXT DEFAULT '#2563EB',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for ordering active exercises efficiently
CREATE INDEX IF NOT EXISTS idx_exercises_active_order ON public.exercises(is_active, display_order);

-- Enable Row Level Security (RLS)
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active exercises for authenticated and anonymous users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'exercises' AND policyname = 'Exercises are viewable by everyone'
  ) THEN
    CREATE POLICY "Exercises are viewable by everyone"
      ON public.exercises
      FOR SELECT
      TO authenticated, anon
      USING (is_active = true);
  END IF;
END $$;

-- Allow authenticated admins / service role full access if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'exercises' AND policyname = 'Service role can manage exercises'
  ) THEN
    CREATE POLICY "Service role can manage exercises"
      ON public.exercises
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Seed the initial Squats exercise
INSERT INTO public.exercises (id, name, category, icon, description, bg_gradient, is_active, display_order)
VALUES (
    '1',
    'Squats',
    'strength',
    '🏋️',
    'AI Real-time MediaPipe Pose Tracker for Parallel Depth & Rep Counting',
    '#2563EB',
    true,
    1
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    bg_gradient = EXCLUDED.bg_gradient,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;
