import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

// Chunked SecureStore adapter — expo-secure-store enforces a 2048-byte value limit.
// Supabase session JSON (access token + user metadata) can exceed this on real accounts,
// so we split values into 512-byte chunks keyed as key.0, key.1, etc.
const CHUNK_SIZE = 512;

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const chunk0 = await SecureStore.getItemAsync(`${key}.0`);
    if (chunk0 === null) return SecureStore.getItemAsync(key); // legacy single-key fallback
    let result = chunk0;
    let i = 1;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
      if (chunk === null) break;
      result += chunk;
      i++;
    }
    return result;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    // Clear any pre-existing chunks and bare key before writing to avoid stale
    // chunk reads if the value length crosses the CHUNK_SIZE boundary.
    await SecureStore.deleteItemAsync(key).catch(() => {});
    let ci = 0;
    while (true) {
      const existing = await SecureStore.getItemAsync(`${key}.${ci}`);
      if (existing === null) break;
      await SecureStore.deleteItemAsync(`${key}.${ci}`);
      ci++;
    }
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    let i = 0;
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(offset, offset + CHUNK_SIZE));
      i++;
    }
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    let i = 0;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
      if (chunk === null) break;
      await SecureStore.deleteItemAsync(`${key}.${i}`);
      i++;
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            SecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
