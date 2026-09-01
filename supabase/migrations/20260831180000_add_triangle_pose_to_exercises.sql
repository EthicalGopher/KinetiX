-- =============================================================================
-- Migration: Add Triangle Pose (Trikonasana) to public.exercises table
-- Positioned right after Squats with display_order = 2
-- =============================================================================

INSERT INTO public.exercises (
  id,
  name,
  category,
  icon,
  description,
  bg_gradient,
  is_active,
  display_order,
  duration_mins,
  muscle_groups,
  reps_target,
  difficulty,
  bg_theme
)
VALUES (
  '3',
  'Triangle Pose',
  'flexibility',
  '📐',
  'AI Real-time Trikonasana Pose Tracker for Leg Extension, Lateral Hinge & Hold Time',
  '#A7F3D0',
  true,
  2,
  20,
  'Hamstrings / Groin / Hips / Core',
  10,
  'Beginner',
  '#A7F3D0'
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
  bg_theme = EXCLUDED.bg_theme,
  updated_at = NOW();

-- Ensure Squats remains display_order = 1
UPDATE public.exercises
SET display_order = 1
WHERE id = '1';
