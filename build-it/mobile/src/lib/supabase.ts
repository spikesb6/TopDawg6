import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { secureStorage } from '@/lib/secure-storage';

// The publishable (anon) key is meant to ship in apps; Row Level Security protects the data.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** False until .env has the Supabase URL and key. The app then keeps everything on the phone. */
export const backendConfigured = Boolean(url && anonKey);

export const supabase = backendConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Only refresh the session while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
