import { create } from 'zustand';
import { supabase } from '../utils/supabase';
import { UserProfile, getOrCreateUserProfile } from '../utils/profileService';

export type MainTab = 'home' | 'explore' | 'workouts' | 'social' | 'profile';

interface UserState {
  user: any | null;
  profile: UserProfile | null;
  activeTab: MainTab;
  selectedExerciseId: string | null;
  setUser: (user: any | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setActiveTab: (tab: MainTab) => void;
  setSelectedExerciseId: (id: string | null) => void;
  refreshProfile: () => Promise<UserProfile | null>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  profile: null,
  activeTab: 'home',
  selectedExerciseId: null,
  setUser: (user) => {
    set({ user });
    if (user) {
      get().refreshProfile();
    } else {
      set({ profile: null });
    }
  },
  setProfile: (profile) => set({ profile }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedExerciseId: (selectedExerciseId) => set({ selectedExerciseId }),
  refreshProfile: async () => {
    const { user } = get();
    if (!user) return null;
    try {
      const profileData = await getOrCreateUserProfile(user);
      set({ profile: profileData });
      return profileData;
    } catch (e) {
      return null;
    }
  },
}));
