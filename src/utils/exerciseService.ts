import { supabase } from './supabase';

export interface ExerciseItem {
  id: string;
  name: string;
  category: 'all' | 'strength' | 'cardio' | 'flexibility';
  icon: string;
  description?: string;
  bgGradient?: string;
  isFavorite?: boolean;
  duration_mins?: number;
  muscle_groups?: string;
  reps_target?: number;
  difficulty?: string;
  bg_theme?: string;
}

export const DEFAULT_EXERCISES: ExerciseItem[] = [
  {
    id: '1',
    name: 'Squats',
    category: 'strength',
    icon: '🏋️',
    description: 'AI Real-time MediaPipe Pose Tracker for Parallel Depth & Rep Counting',
    bgGradient: '#C8B6FF',
    isFavorite: true,
    duration_mins: 25,
    muscle_groups: 'Glutes / Quads / Hamstrings',
    reps_target: 15,
    difficulty: 'Intermediate',
    bg_theme: '#C8B6FF',
  },
  {
    id: '3',
    name: 'Triangle Pose',
    category: 'flexibility',
    icon: '📐',
    description: 'AI Real-time Trikonasana Pose Tracker for Leg Extension, Lateral Hinge & Hold Time',
    bgGradient: '#A7F3D0',
    isFavorite: true,
    duration_mins: 20,
    muscle_groups: 'Hamstrings / Groin / Hips / Core',
    reps_target: 10,
    difficulty: 'Beginner',
    bg_theme: '#A7F3D0',
  },
  {
    id: '4',
    name: 'Lunges',
    category: 'strength',
    icon: '🦵',
    description: 'Unilateral lead-leg tracking, knee angle depth & balance analyzer',
    bgGradient: '#FFD6E0',
    isFavorite: true,
    duration_mins: 22,
    muscle_groups: 'Quads / Glutes / Calves',
    reps_target: 16,
    difficulty: 'Intermediate',
    bg_theme: '#FFD6E0',
  },
  {
    id: '5',
    name: 'Crunches',
    category: 'flexibility',
    icon: '🧘',
    description: 'Abdominal flexion & shoulder blade elevation core tracker',
    bgGradient: '#E2F163',
    isFavorite: true,
    duration_mins: 18,
    muscle_groups: 'Upper Abs / Core / Obliques',
    reps_target: 20,
    difficulty: 'Beginner',
    bg_theme: '#E2F163',
  },
  {
    id: '2',
    name: 'Sit-ups',
    category: 'strength',
    icon: '💪',
    description: 'Full torso elevation & hip flexion complete core tracker',
    bgGradient: '#C8B6FF',
    isFavorite: true,
    duration_mins: 20,
    muscle_groups: 'Abdominals / Hip Flexors / Core',
    reps_target: 15,
    difficulty: 'Intermediate',
    bg_theme: '#C8B6FF',
  },
];

export async function fetchExercisesFromSupabase(): Promise<ExerciseItem[]> {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.warn('Could not fetch exercises from Supabase, using local defaults:', error.message);
      return DEFAULT_EXERCISES;
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: String(row.id),
        name: row.name,
        category: row.category as ExerciseItem['category'],
        icon: row.icon || '🏋️',
        description: row.description || '',
        bgGradient: row.bg_gradient || row.bg_theme || '#C8B6FF',
        isFavorite: true,
        duration_mins: row.duration_mins || 30,
        muscle_groups: row.muscle_groups || 'Glutes / Squats / Core',
        reps_target: row.reps_target || 15,
        difficulty: row.difficulty || 'Intermediate',
        bg_theme: row.bg_theme || row.bg_gradient || '#C8B6FF',
      }));
    }

    return DEFAULT_EXERCISES;
  } catch (err: any) {
    console.warn('Error fetching exercises from Supabase:', err?.message || err);
    return DEFAULT_EXERCISES;
  }
}
