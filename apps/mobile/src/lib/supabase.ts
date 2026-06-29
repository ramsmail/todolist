import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// Web (incl. static prerender in Node) has no SecureStore — use localStorage when
// available, otherwise a no-op so the bundle doesn't crash during SSR.
const WebStorageAdapter = {
  getItem: async (key: string): Promise<string | null> =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null,
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

// expo-secure-store caps values at 2048 bytes; Supabase sessions can exceed that,
// so split into 512-byte chunks keyed key.0, key.1, ...
const CHUNK = 512;

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const first = await SecureStore.getItemAsync(`${key}.0`);
    if (first === null) return SecureStore.getItemAsync(key);
    let value = first;
    let i = 1;
    for (;;) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) break;
      value += part;
      i++;
    }
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    let ci = 0;
    for (;;) {
      const existing = await SecureStore.getItemAsync(`${key}.${ci}`);
      if (existing === null) break;
      await SecureStore.deleteItemAsync(`${key}.${ci}`);
      ci++;
    }
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    let i = 0;
    for (let o = 0; o < value.length; o += CHUNK) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(o, o + CHUNK));
      i++;
    }
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    let i = 0;
    for (;;) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) break;
      await SecureStore.deleteItemAsync(`${key}.${i}`);
      i++;
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? WebStorageAdapter : SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
