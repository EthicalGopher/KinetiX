import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.codequestpro.in';

export type MatchMessage =
  | { type: 'joined'; user_id: string }
  | { type: 'matched'; match_id: string; role: 'player1' | 'player2'; opponent: string }
  | { type: 'frame'; data: string }
  | { type: 'pose'; landmarks: any[]; fps: number }
  | { type: 'score'; score: number }
  | { type: 'peer_ready' }
  | { type: 'rematch_request'; sender?: string }
  | { type: 'rematch_accepted'; sender?: string }
  | { type: 'rematch_declined'; sender?: string }
  | { type: 'leave' };

export type QueueCounts = {
  total_online: number;
  exercise_counts: Record<string, number>;
};

let socket: WebSocket | null = null;
let realtimeMatchChannel: RealtimeChannel | null = null;
let currentMatchRoomId: string | null = null;
let currentSenderUserId: string | null = null;
let messageListeners: ((msg: MatchMessage) => void)[] = [];
let connectListeners: ((counts: QueueCounts) => void)[] = [];
let wsUrl: string | null = null;

const getWsUrl = (httpUrl: string) => {
  if (httpUrl.startsWith('https://')) {
    return 'wss://' + httpUrl.slice(8);
  }
  if (httpUrl.startsWith('http://')) {
    return 'ws://' + httpUrl.slice(7);
  }
  return httpUrl.replace(/^http/, 'ws');
};

export const connectMatchSocket = (userId?: string, roomIdOrExerciseId?: string) => {
  const url = `${getWsUrl(BACKEND_URL)}/ws/match`;
  wsUrl = url;
  currentSenderUserId = userId || `anon_${Date.now()}`;
  currentMatchRoomId = roomIdOrExerciseId || 'default_room';

  // 1. Setup Backend WebSocket
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }

  try {
    socket = new WebSocket(url);

    socket.onopen = () => {
      socket?.send(
        JSON.stringify({
          user_id: currentSenderUserId,
          exercise_id: currentMatchRoomId,
        })
      );
      fetch(`${BACKEND_URL}/api/online`)
        .then((r) => r.json())
        .then((counts: QueueCounts) => {
          connectListeners.forEach((cb) => cb(counts));
        })
        .catch(() => {});
    };

    socket.onmessage = (event) => {
      try {
        const msg: MatchMessage = JSON.parse(event.data);
        messageListeners.forEach((cb) => cb(msg));
      } catch (e) {}
    };

    socket.onerror = () => {};
    socket.onclose = () => {};
  } catch (e) {}

  // 2. Setup High-Reliability Supabase Realtime Channel
  if (realtimeMatchChannel) {
    supabase.removeChannel(realtimeMatchChannel);
  }

  const roomTopic = `match_realtime_${currentMatchRoomId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  realtimeMatchChannel = supabase.channel(roomTopic, {
    config: {
      broadcast: { self: false },
    },
  });

  realtimeMatchChannel
    .on('broadcast', { event: 'match_msg' }, ({ payload }: { payload: { sender: string; msg: MatchMessage } }) => {
      if (payload && payload.msg && payload.sender !== currentSenderUserId) {
        messageListeners.forEach((cb) => cb(payload.msg));
      }
    })
    .subscribe();
};

export const sendMatchMessage = (msg: MatchMessage) => {
  // Send via WebSocket
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(msg));
    } catch (e) {}
  }

  // Send via Supabase Realtime broadcast
  if (realtimeMatchChannel) {
    try {
      realtimeMatchChannel.send({
        type: 'broadcast',
        event: 'match_msg',
        payload: {
          sender: currentSenderUserId,
          msg,
        },
      });
    } catch (e) {}
  }
};

export const addMatchMessageListener = (cb: (msg: MatchMessage) => void) => {
  messageListeners.push(cb);
  return () => {
    messageListeners = messageListeners.filter((l) => l !== cb);
  };
};

export const addConnectListener = (cb: (counts: QueueCounts) => void) => {
  connectListeners.push(cb);
  return () => {
    connectListeners = connectListeners.filter((l) => l !== cb);
  };
};

export const disconnectMatchSocket = () => {
  if (socket) {
    try {
      socket.send(JSON.stringify({ type: 'leave' }));
    } catch (e) {}
    socket.close();
    socket = null;
  }

  if (realtimeMatchChannel) {
    try {
      supabase.removeChannel(realtimeMatchChannel);
    } catch (e) {}
    realtimeMatchChannel = null;
  }
};

export const fetchQueueCounts = async (): Promise<QueueCounts> => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/online`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (e) {
    return { total_online: 1, exercise_counts: {} };
  }
};

// ============= PRESENCE (online count tracking) =============

let presenceSocket: WebSocket | null = null;

export const connectPresenceSocket = (userId?: string) => {
  try {
    const url = `${getWsUrl(BACKEND_URL)}/ws/presence`;
    presenceSocket = new WebSocket(url);

    presenceSocket.onopen = () => {
      presenceSocket?.send(
        JSON.stringify({
          user_id: userId || `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        })
      );
    };

    presenceSocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'online') {
          connectListeners.forEach((cb) => cb({ total_online: msg.total, exercise_counts: {} }));
        }
      } catch (e) {}
    };

    presenceSocket.onerror = () => {};
    presenceSocket.onclose = () => {};
  } catch (e) {}
};

export const disconnectPresenceSocket = () => {
  if (presenceSocket) {
    presenceSocket.close();
    presenceSocket = null;
  }
};
