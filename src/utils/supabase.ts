import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://locsjrjekkyjbeapgreu.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_sHRSstl83vk7Yrurd4aWgA_ENJRFgBm';

const storage: { [key: string]: string } = {};

const memoryStorage = {
  getItem: (key: string) => Promise.resolve(storage[key] ?? null),
  setItem: (key: string, value: string) => {
    storage[key] = value;
    return Promise.resolve(undefined);
  },
  removeItem: (key: string) => {
    delete storage[key];
    return Promise.resolve(undefined);
  },
};

const supabaseFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  if (SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
    const headers = new Headers(init.headers);
    if (!headers.has('apikey')) {
      headers.set('apikey', SUPABASE_ANON_KEY);
    }
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    }
    init.headers = headers;
  }
  return fetch(input, init);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: memoryStorage as any,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: supabaseFetch as any,
  },
});
