import { useEffect, useRef, useState, useCallback } from 'react';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.codequestpro.in';

export interface FFALeaderboardPlayer {
  username: string;
  score: number;
  avatar_url?: string | null;
}

export type MatchMessage =
  | { type: 'joined'; user_id: string }
  | { type: 'matched'; match_id: string; exercise_id?: string; role: 'player1' | 'player2'; opponent: string }
  | { type: 'ffa_lobby_update'; match_id: string; exercise_id: string; players: string[]; player_count: number; countdown: number; status: string }
  | { type: 'ffa_matched'; match_id: string; exercise_id: string; mode: 'ffa'; players: string[]; player_count: number }
  | { type: 'ffa_leaderboard'; match_id: string; leaderboard: FFALeaderboardPlayer[]; sender?: string; score?: number }
  | { type: 'ffa_game_end'; match_id: string; leaderboard: FFALeaderboardPlayer[]; sender?: string }
  | { type: 'player_left_ffa'; match_id?: string; sender?: string; players?: string[] }
  | { type: 'frame'; data: string; match_id?: string }
  | { type: 'pose'; landmarks: any[]; fps: number }
  | { type: 'score'; score: number; match_id?: string; sender?: string }
  | { type: 'peer_ready'; match_id?: string; sender?: string }
  | { type: 'game_end'; match_id?: string; player1_score?: number; player2_score?: number; sender?: string }
  | { type: 'rematch_request'; match_id?: string; sender?: string }
  | { type: 'rematch_accepted'; match_id?: string; sender?: string }
  | { type: 'rematch_declined'; match_id?: string; sender?: string }
  | { type: 'opponent_left'; match_id?: string; reason?: string; sender?: string }
  | { type: 'match_leave'; match_id?: string; reason?: string; sender?: string }
  | { type: 'leave'; sender?: string }
  | { type: 'ping' }
  | { type: 'pong'; time?: number };

export type QueueCounts = {
  total_online: number;
  exercise_counts: Record<string, number>;
};

let socket: WebSocket | null = null;
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

export const isMatchSocketConnected = () => {
  return socket !== null && socket.readyState === WebSocket.OPEN;
};

export const connectMatchSocket = (userId?: string, roomIdOrExerciseId?: string) => {
  const url = `${getWsUrl(BACKEND_URL)}/ws/match`;
  const nextUserId = userId || `anon_${Date.now()}`;
  const nextRoomId = roomIdOrExerciseId || 'default_room';

  // If already connected for the same user and room/queue, don't destroy and reconnect
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) &&
    currentSenderUserId === nextUserId &&
    currentMatchRoomId === nextRoomId
  ) {
    return;
  }

  currentSenderUserId = nextUserId;
  currentMatchRoomId = nextRoomId;
  wsUrl = url;

  if (socket) {
    try {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    } catch (e) {}
    socket = null;
  }

  try {
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      if (socket !== ws) return;
      console.log(`[Matchmaking] Connected to ${url} as ${currentSenderUserId} in room ${currentMatchRoomId}`);
      ws.send(
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
        .catch((err) => {
          console.warn('[Matchmaking] Failed to fetch queue counts:', err);
        });
    };

    ws.onmessage = (event) => {
      if (socket !== ws) return;
      try {
        const msg: MatchMessage = JSON.parse(event.data);
        messageListeners.forEach((cb) => cb(msg));
      } catch (e) {
        console.warn('[Matchmaking] Failed to parse message payload:', event.data, e);
      }
    };

    ws.onerror = (e) => {
      console.warn('[Matchmaking] WebSocket error encountered:', e);
    };

    ws.onclose = (event) => {
      console.log(`[Matchmaking] WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
      if (socket === ws) {
        socket = null;
      }
    };
  } catch (e) {
    console.error('[Matchmaking] Failed to instantiate WebSocket:', e);
  }
};

export const sendMatchMessage = (msg: MatchMessage) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(msg));
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
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'leave' }));
        socket.close();
      }
    } catch (e) {}
    socket = null;
  }
  currentMatchRoomId = null;
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
