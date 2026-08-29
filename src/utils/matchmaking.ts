import { useEffect, useRef, useState, useCallback } from 'react';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.codequestpro.in';

export type MatchMessage =
  | { type: 'joined'; user_id: string }
  | { type: 'matched'; match_id: string; role: 'player1' | 'player2'; opponent: string }
  | { type: 'frame'; data: string }
  | { type: 'pose'; landmarks: any[]; fps: number }
  | { type: 'leave' };

export type QueueCounts = {
  total_online: number;
  exercise_counts: Record<string, number>;
};

let socket: WebSocket | null = null;
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

export const connectMatchSocket = (userId?: string, exerciseId?: string) => {
  const url = `${getWsUrl(BACKEND_URL)}/ws/match`;
  wsUrl = url;

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }

  socket = new WebSocket(url);

  socket.onopen = () => {
    socket?.send(
      JSON.stringify({
        user_id: userId || `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        exercise_id: exerciseId || '1',
      })
    );
    fetch(`${BACKEND_URL}/api/online`)
      .then((r) => r.json())
      .then((counts: QueueCounts) => {
        connectListeners.forEach((cb) => cb(counts));
      })
      .catch((e) => console.log('[MatchSocket] online count fetch failed:', e.message));
  };

  socket.onmessage = (event) => {
    const msg: MatchMessage = JSON.parse(event.data);
    messageListeners.forEach((cb) => cb(msg));
  };

  socket.onerror = (err) => {
    console.warn('[MatchSocket] WebSocket error:', err);
  };

  socket.onclose = () => {
    console.log('[MatchSocket] WebSocket closed');
  };
};

export const sendMatchMessage = (msg: MatchMessage) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  } else {
    console.warn('[MatchSocket] Cannot send — socket not open');
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
};

export const fetchQueueCounts = async (): Promise<QueueCounts> => {
  const res = await fetch(`${BACKEND_URL}/api/online`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// ============= PRESENCE (online count tracking) =============

let presenceSocket: WebSocket | null = null;

export const connectPresenceSocket = (userId?: string) => {
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
    const msg = JSON.parse(event.data);
    if (msg.type === 'online') {
      connectListeners.forEach((cb) => cb({ total_online: msg.total, exercise_counts: {} }));
    }
  };

  presenceSocket.onerror = (err) => {
    console.warn('[PresenceSocket] WebSocket error:', err);
  };

  presenceSocket.onclose = () => {
    console.log('[PresenceSocket] WebSocket closed');
  };
};

export const disconnectPresenceSocket = () => {
  if (presenceSocket) {
    presenceSocket.close();
    presenceSocket = null;
  }
};

// ============= STREAMING (/{username} path) =============

let streamSocket: WebSocket | null = null;
let streamMessageListeners: ((msg: any) => void)[] = [];

export const connectStreamSocket = (username: string, role: 'sender' | 'viewer') => {
  const url = `${getWsUrl(BACKEND_URL)}/ws/stream/${encodeURIComponent(username)}`;
  streamSocket = new WebSocket(url);

  streamSocket.onopen = () => {
    streamSocket?.send(JSON.stringify({ type: role, role }));
    console.log('[StreamSocket] Connected as', role, 'to', username);
  };

  streamSocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    streamMessageListeners.forEach((cb) => cb(msg));
  };

  streamSocket.onerror = (err) => {
    console.warn('[StreamSocket] WebSocket error:', err);
  };

  streamSocket.onclose = () => {
    console.log('[StreamSocket] WebSocket closed');
  };
};

export const sendStreamFrame = (frameData: string) => {
  if (streamSocket && streamSocket.readyState === WebSocket.OPEN) {
    streamSocket.send(JSON.stringify({ type: 'frame', data: frameData }));
  }
};

export const addStreamMessageListener = (cb: (msg: any) => void) => {
  streamMessageListeners.push(cb);
  return () => {
    streamMessageListeners = streamMessageListeners.filter((l) => l !== cb);
  };
};

export const disconnectStreamSocket = () => {
  if (streamSocket) {
    streamSocket.close();
    streamSocket = null;
  }
};

export const useMatchmaking = (userId?: string, exerciseId?: string) => {
  const [counts, setCounts] = useState<QueueCounts>({ total_online: 0, exercise_counts: {} });
  const [match, setMatch] = useState<
    { match_id: string; role: 'player1' | 'player2'; opponent: string } | null
  >(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const cleanupFns: (() => void)[] = [];

    const onConnect = (c: QueueCounts) => {
      setCounts(c);
      setIsConnected(true);
    };
    cleanupFns.push(addConnectListener(onConnect));

    const onMessage = (msg: MatchMessage) => {
      if (msg.type === 'matched') {
        setMatch({
          match_id: msg.match_id,
          role: msg.role,
          opponent: msg.opponent,
        });
      }
    };
    cleanupFns.push(addMatchMessageListener(onMessage));

    connectMatchSocket(userId, exerciseId);

    const interval = setInterval(async () => {
      try {
        const c = await fetchQueueCounts();
        setCounts(c);
      } catch (e) {
        console.log('[useMatchmaking] fetch counts error:', (e as Error).message);
      }
    }, 3000);
    cleanupFns.push(() => clearInterval(interval));

    return () => {
      cleanupFns.forEach((fn) => fn());
      disconnectMatchSocket();
    };
  }, [userId, exerciseId]);

  const sendMessage = useCallback((msg: MatchMessage) => {
    sendMatchMessage(msg);
  }, []);

  const joinQueue = useCallback((exercise: string) => {
    connectMatchSocket(userId, exercise);
  }, [userId]);

  const cancelQueue = useCallback(() => {
    disconnectMatchSocket();
    setIsConnected(false);
  }, []);

  return { counts, match, isConnected, sendMessage, joinQueue, cancelQueue };
};
