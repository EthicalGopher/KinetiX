-- =============================================================================
-- Migration: Add dynamic fields to exercises table & seed diverse workouts
-- =============================================================================

ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS duration_mins INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS muscle_groups TEXT DEFAULT 'Glutes / Squats / Hamstrings',
ADD COLUMN IF NOT EXISTS reps_target INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'Intermediate',
ADD COLUMN IF NOT EXISTS bg_theme TEXT DEFAULT '#C8B6FF';

-- Upsert exercises with complete dynamic details
INSERT INTO public.exercises (id, name, category, icon, description, bg_gradient, is_active, display_order, duration_mins, muscle_groups, reps_target, difficulty, bg_theme)
VALUES
  (
    '1',
    'Squats',
    'strength',
    '🏋️',
    'AI Real-time MediaPipe Pose Tracker for Parallel Depth & Rep Counting',
    '#C8B6FF',
    true,
    1,
    32,
    'Glutes / Squats / Hamstrings',
    15,
    'Intermediate',
    '#C8B6FF'
  ),
  (
    '2',
    'Pushups',
    'strength',
    '💪',
    'MediaPipe chest depth & full elbow lockout upper body tracker',
    '#FFD6E0',
    true,
    2,
    25,
    'Chest / Shoulders / Triceps',
    20,
    'Intermediate',
    '#FFD6E0'
  ),
  (
    '3',
    'Jumping Jacks',
    'cardio',
    '⚡',
    'High intensity arm & leg synchronization cardio pace tracker',
    '#E2F163',
    true,
    3,
    20,
    'Full Body / Cardio / Stamina',
    30,
    'Beginner',
    '#E2F163'
  ),
  (
    '4',
    'Lunges',
    'strength',
    '🦵',
    'Unilateral leg balance & knee bend posture analyzer',
    '#C8B6FF',
    true,
    4,
    28,
    'Quads / Glutes / Calves',
    16,
    'Intermediate',
    '#C8B6FF'
  ),
  (
    '5',
    'Plank & Core',
    'flexibility',
    '🧘',
    'Spine stability & pelvic alignment core endurance timer',
    '#FFD6E0',
    true,
    5,
    15,
    'Abs / Obliques / Lower Back',
    60,
    'Advanced',
    '#FFD6E0'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  bg_gradient = EXCLUDED.bg_gradient,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  duration_mins = EXCLUDED.duration_mins,
  muscle_groups = EXCLUDED.muscle_groups,
  reps_target = EXCLUDED.reps_target,
  difficulty = EXCLUDED.difficulty,
  bg_theme = EXCLUDED.bg_theme;
