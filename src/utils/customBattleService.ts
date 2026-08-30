import { supabase } from './supabase';
import { AvatarConfig } from '../components/Avatar';

export type BattleMode = 'faceoff' | 'quickjoin';

export interface BattleInvite {
  id: string;
  senderId: string;
  senderUsername: string;
  senderAvatar?: AvatarConfig;
  receiverId: string;
  receiverUsername: string;
  exerciseId: string;
  exerciseName: string;
  mode: BattleMode;
  createdAt: number;
  matchRoomId?: string;
}

type InviteCallback = (invite: BattleInvite) => void;
type ResponseCallback = (data: {
  inviteId: string;
  accepted: boolean;
  matchRoomId?: string;
  opponentUsername?: string;
  mode?: BattleMode;
  exerciseId?: string;
}) => void;

let activeBattleChannel: any = null;
let currentUserId: string | null = null;
const inviteListeners: InviteCallback[] = [];
const responseListeners: ResponseCallback[] = [];

/**
 * Initializes and subscribes to real-time custom battle events for a user.
 */
export function initBattleChannel(
  userId: string,
  onInvite?: InviteCallback,
  onResponse?: ResponseCallback
) {
  if (onInvite) inviteListeners.push(onInvite);
  if (onResponse) responseListeners.push(onResponse);

  if (activeBattleChannel && currentUserId === userId) {
    return () => {
      if (onInvite) {
        const idx = inviteListeners.indexOf(onInvite);
        if (idx !== -1) inviteListeners.splice(idx, 1);
      }
      if (onResponse) {
        const idx = responseListeners.indexOf(onResponse);
        if (idx !== -1) responseListeners.splice(idx, 1);
      }
    };
  }

  if (activeBattleChannel) {
    supabase.removeChannel(activeBattleChannel);
  }

  currentUserId = userId;
  activeBattleChannel = supabase.channel(`battles_${userId}`, {
    config: {
      broadcast: { self: false },
    },
  });

  activeBattleChannel
    .on('broadcast', { event: 'custom_battle_invite' }, ({ payload }: { payload: BattleInvite }) => {
      if (payload && payload.receiverId === userId) {
        inviteListeners.forEach((cb) => cb(payload));
      }
    })
    .on('broadcast', { event: 'custom_battle_response' }, ({ payload }: any) => {
      if (payload) {
        responseListeners.forEach((cb) => cb(payload));
      }
    })
    .subscribe();

  return () => {
    if (onInvite) {
      const idx = inviteListeners.indexOf(onInvite);
      if (idx !== -1) inviteListeners.splice(idx, 1);
    }
    if (onResponse) {
      const idx = responseListeners.indexOf(onResponse);
      if (idx !== -1) responseListeners.splice(idx, 1);
    }
  };
}

/**
 * Sends a custom 1v1 battle challenge to a specific friend.
 */
export async function sendCustomBattleInvite(
  sender: { id: string; username: string; avatar_config?: AvatarConfig },
  receiver: { id: string; username: string },
  exerciseId: string,
  exerciseName: string,
  mode: BattleMode = 'faceoff'
): Promise<BattleInvite> {
  const invite: BattleInvite = {
    id: `invite_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    senderId: sender.id,
    senderUsername: sender.username,
    senderAvatar: sender.avatar_config,
    receiverId: receiver.id,
    receiverUsername: receiver.username,
    exerciseId,
    exerciseName,
    mode,
    createdAt: Date.now(),
    matchRoomId: `room_${sender.username}_${receiver.username}_${Date.now()}`,
  };

  // Broadcast to receiver's dedicated channel
  const targetChannel = supabase.channel(`battles_${receiver.id}`);
  await targetChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      targetChannel.send({
        type: 'broadcast',
        event: 'custom_battle_invite',
        payload: invite,
      });
    }
  });

  return invite;
}

/**
 * Accepts an incoming custom battle challenge.
 */
export async function acceptCustomBattleInvite(
  invite: BattleInvite,
  currentUsername: string
) {
  const matchRoomId =
    invite.matchRoomId || `room_${invite.senderUsername}_${currentUsername}_${Date.now()}`;

  const payload = {
    inviteId: invite.id,
    accepted: true,
    matchRoomId,
    opponentUsername: currentUsername,
    mode: invite.mode,
    exerciseId: invite.exerciseId,
  };

  // Notify sender on sender's channel
  const senderChannel = supabase.channel(`battles_${invite.senderId}`);
  await senderChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      senderChannel.send({
        type: 'broadcast',
        event: 'custom_battle_response',
        payload,
      });
    }
  });

  return matchRoomId;
}

/**
 * Declines an incoming custom battle challenge.
 */
export async function declineCustomBattleInvite(invite: BattleInvite) {
  const payload = {
    inviteId: invite.id,
    accepted: false,
  };

  const senderChannel = supabase.channel(`battles_${invite.senderId}`);
  await senderChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      senderChannel.send({
        type: 'broadcast',
        event: 'custom_battle_response',
        payload,
      });
    }
  });
}
