import { supabase } from './supabase';
import { AvatarConfig } from '../components/Avatar';

export interface FriendProfile {
  id: string;
  username: string;
  full_name?: string;
  avatar_config?: AvatarConfig;
  avatar_url?: string | null;
  bio?: string;
  fitness_goal?: string;
}

export interface FriendshipItem {
  id: string;
  friendship_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  created_at: string;
  friend: FriendProfile;
  is_sender: boolean;
}

/**
 * Sends a friend request to a user identified by their username.
 */
export async function sendFriendRequest(
  senderId: string,
  receiverUsername: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!senderId || !receiverUsername?.trim()) {
    return { success: false, error: 'Please enter a valid username.' };
  }

  try {
    const { data, error } = await supabase.rpc('send_friend_request_by_username', {
      p_sender_id: senderId,
      p_receiver_username: receiverUsername.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error };
    }

    return { success: true, message: data?.message || 'Friend request sent!' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send friend request.' };
  }
}

/**
 * Fetches all accepted friends for a user.
 */
export async function fetchFriends(userId: string): Promise<FriendshipItem[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, sender_id, receiver_id, status, created_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false });

    if (error || !data) return [];

    const friendUserIds = data.map((item) =>
      item.sender_id === userId ? item.receiver_id : item.sender_id
    );

    if (friendUserIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_config, bio, fitness_goal')
      .in('id', friendUserIds);

    const profilesMap = new Map<string, FriendProfile>();
    (profiles || []).forEach((p) => profilesMap.set(p.id, p));

    return data
      .map((item) => {
        const friendId = item.sender_id === userId ? item.receiver_id : item.sender_id;
        const profile = profilesMap.get(friendId);
        if (!profile) return null;

        return {
          id: friendId,
          friendship_id: item.id,
          status: item.status,
          created_at: item.created_at,
          friend: profile,
          is_sender: item.sender_id === userId,
        };
      })
      .filter((item): item is FriendshipItem => item !== null);
  } catch (err) {
    console.warn('Failed to fetch friends:', err);
    return [];
  }
}

/**
 * Fetches pending incoming friend requests for the user.
 */
export async function fetchIncomingRequests(userId: string): Promise<FriendshipItem[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, sender_id, receiver_id, status, created_at')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return [];

    const senderIds = data.map((d) => d.sender_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_config, bio, fitness_goal')
      .in('id', senderIds);

    const profilesMap = new Map<string, FriendProfile>();
    (profiles || []).forEach((p) => profilesMap.set(p.id, p));

    return data
      .map((item) => {
        const profile = profilesMap.get(item.sender_id);
        if (!profile) return null;

        return {
          id: item.sender_id,
          friendship_id: item.id,
          status: item.status,
          created_at: item.created_at,
          friend: profile,
          is_sender: false,
        };
      })
      .filter((item): item is FriendshipItem => item !== null);
  } catch (err) {
    console.warn('Failed to fetch incoming requests:', err);
    return [];
  }
}

/**
 * Fetches pending outgoing friend requests sent by the user.
 */
export async function fetchOutgoingRequests(userId: string): Promise<FriendshipItem[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, sender_id, receiver_id, status, created_at')
      .eq('sender_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return [];

    const receiverIds = data.map((d) => d.receiver_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_config, bio, fitness_goal')
      .in('id', receiverIds);

    const profilesMap = new Map<string, FriendProfile>();
    (profiles || []).forEach((p) => profilesMap.set(p.id, p));

    return data
      .map((item) => {
        const profile = profilesMap.get(item.receiver_id);
        if (!profile) return null;

        return {
          id: item.receiver_id,
          friendship_id: item.id,
          status: item.status,
          created_at: item.created_at,
          friend: profile,
          is_sender: true,
        };
      })
      .filter((item): item is FriendshipItem => item !== null);
  } catch (err) {
    console.warn('Failed to fetch outgoing requests:', err);
    return [];
  }
}

/**
 * Accepts a friend request.
 */
export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Rejects or cancels a friend request / removes a friendship.
 */
export async function deleteFriendship(friendshipId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    return !error;
  } catch {
    return false;
  }
}
