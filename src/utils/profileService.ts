import { supabase } from './supabase';
import { AvatarConfig, AvatarStyle } from '../components/Avatar';
import { generateRandomUsername } from './usernameGenerator';

export interface UserProfile {
  id: string;
  username: string;
  phone_number?: string;
  full_name?: string;
  avatar_config?: AvatarConfig;
  bio?: string;
  fitness_goal?: string;
  created_at?: string;
  updated_at?: string;
}

export const generateDefaultAvatar = (username: string, style: AvatarStyle = 'adventurer'): AvatarConfig => {
  return {
    seed: username.trim() || 'athlete',
    style,
  };
};

/**
 * Fetch a user's profile from the public.profiles table.
 * If the profile does not exist yet, creates and returns a default profile.
 */
export async function getOrCreateUserProfile(user: any): Promise<UserProfile> {
  if (!user?.id) {
    throw new Error('User ID is required');
  }

  let defaultUsername = user.user_metadata?.username;
  if (!defaultUsername && user.email) {
    defaultUsername = user.email.split('@')[0];
  }
  if (!defaultUsername) {
    try {
      defaultUsername = await generateRandomUsername();
    } catch {
      defaultUsername = `athlete_${user.id.slice(0, 5)}`;
    }
  }

  const defaultAvatar = generateDefaultAvatar(defaultUsername);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data) {
      return {
        ...data,
        avatar_config: data.avatar_config && Object.keys(data.avatar_config).length > 0 ? data.avatar_config : defaultAvatar,
      };
    }

    // If table or row doesn't exist, construct profile from auth metadata
    const initialProfile: UserProfile = {
      id: user.id,
      username: defaultUsername,
      phone_number: user.user_metadata?.phone_number || user.phone || '',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      avatar_config: user.user_metadata?.avatar_config || defaultAvatar,
      bio: 'Ready to crush daily fitness milestones with plato! 🔥',
      fitness_goal: 'Strength & Stamina',
    };

    // Try inserting into Supabase profiles table
    try {
      const { data: insertedData, error: insertError } = await supabase
        .from('profiles')
        .insert([initialProfile])
        .select()
        .single();

      if (!insertError && insertedData) {
        return insertedData;
      }
    } catch (e) {
      console.warn('Could not insert initial profile to Supabase table:', e);
    }

    return initialProfile;
  } catch (err) {
    console.error('Error fetching profile:', err);
    return {
      id: user.id,
      username: defaultUsername,
      phone_number: '',
      full_name: '',
      avatar_config: defaultAvatar,
      bio: 'Ready to crush daily fitness milestones with plato! 🔥',
      fitness_goal: 'Strength & Stamina',
    };
  }
}

/**
 * Update user profile details (username, phone_number, full_name, bio, avatar_config, etc.)
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // 1. Update in Supabase public.profiles table
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();

    // 2. Also sync essential fields to auth.users user_metadata for offline/fast load
    try {
      await supabase.auth.updateUser({
        data: {
          username: updates.username,
          phone_number: updates.phone_number,
          full_name: updates.full_name,
          avatar_config: updates.avatar_config,
        },
      });
    } catch (metaErr) {
      console.warn('Could not sync user_metadata:', metaErr);
    }

    if (error) {
      // If table update fails (e.g. table not created yet), return success with local state
      return { success: true, data: { id: userId, ...updates } as UserProfile };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Error updating profile:', err);
    return { success: false, error: err.message || 'Failed to update profile' };
  }
}
