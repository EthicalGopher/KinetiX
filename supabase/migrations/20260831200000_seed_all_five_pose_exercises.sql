-- =============================================================================
-- Migration: Seed all 5 exercises from backend/Pose/ into public.exercises
-- 1. Squats
-- 2. Triangle Pose
-- 3. Lunges
-- 4. Crunches
-- 5. Sit-ups
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
    25,
    'Glutes / Quads / Hamstrings',
    15,
    'Intermediate',
    '#C8B6FF'
  ),
  (
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
  ),
  (
    '4',
    'Lunges',
    'strength',
    '🦵',
    'Unilateral lead-leg tracking, knee angle depth & balance analyzer',
    '#FFD6E0',
    true,
    3,
    22,
    'Quads / Glutes / Calves',
    16,
    'Intermediate',
    '#FFD6E0'
  ),
  (
    '5',
    'Crunches',
    'flexibility',
    '🧘',
    'Abdominal flexion & shoulder blade elevation core tracker',
    '#E2F163',
    true,
    4,
    18,
    'Upper Abs / Core / Obliques',
    20,
    'Beginner',
    '#E2F163'
  ),
  (
    '2',
    'Sit-ups',
    'strength',
    '💪',
    'Full torso elevation & hip flexion complete core tracker',
    '#C8B6FF',
    true,
    5,
    20,
    'Abdominals / Hip Flexors / Core',
    15,
    'Intermediate',
    '#C8B6FF'
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
