import { supabase } from './supabase';
import type { ExerciseItem } from '../screens/ExercisesScreen';

export const DEFAULT_EXERCISES: ExerciseItem[] = [
  {
    id: '1',
    name: 'Squats',
    category: 'strength',
    icon: '🏋️',
    description: 'AI Real-time MediaPipe Pose Tracker for Parallel Depth & Rep Counting',
    bgGradient: '#2563EB',
    isFavorite: true,
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
        id: row.id,
        name: row.name,
        category: row.category as ExerciseItem['category'],
        icon: row.icon || '🏋️',
        description: row.description || '',
        bgGradient: row.bg_gradient || '#2563EB',
        isFavorite: true,
      }));
    }

    return DEFAULT_EXERCISES;
  } catch (err: any) {
    console.warn('Error fetching exercises from Supabase:', err?.message || err);
    return DEFAULT_EXERCISES;
  }
}
