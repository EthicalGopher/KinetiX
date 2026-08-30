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
    duration_mins: 32,
    muscle_groups: 'Glutes / Squats / Hamstrings',
    reps_target: 15,
    difficulty: 'Intermediate',
    bg_theme: '#C8B6FF',
  },
  {
    id: '2',
    name: 'Pushups',
    category: 'strength',
    icon: '💪',
    description: 'MediaPipe chest depth & full elbow lockout upper body tracker',
    bgGradient: '#FFD6E0',
    isFavorite: true,
    duration_mins: 25,
    muscle_groups: 'Chest / Shoulders / Triceps',
    reps_target: 20,
    difficulty: 'Intermediate',
    bg_theme: '#FFD6E0',
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
