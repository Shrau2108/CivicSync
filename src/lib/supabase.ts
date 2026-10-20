import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'civicsync_supabase_url';
const STORAGE_KEY_KEY = 'civicsync_supabase_anon_key';

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'env' | 'localStorage' | 'none';
} {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (envUrl && envKey && !envUrl.includes('demo-placeholder') && !envKey.includes('demo-placeholder')) {
    return { url: envUrl, anonKey: envKey, isConfigured: true, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem(STORAGE_URL_KEY)?.trim();
    const localKey = localStorage.getItem(STORAGE_KEY_KEY)?.trim();
    if (localUrl && localKey && !localUrl.includes('demo-placeholder') && !localKey.includes('demo-placeholder')) {
      return { url: localUrl, anonKey: localKey, isConfigured: true, source: 'localStorage' };
    }
  }

  return {
    url: 'https://demo-placeholder.supabase.co',
    anonKey: 'demo-placeholder-anon-key',
    isConfigured: false,
    source: 'none',
  };
}

const currentConfig = getSupabaseConfig();

export const isSupabaseConfigured = currentConfig.isConfigured;

export const supabase: SupabaseClient = createClient(
  currentConfig.url,
  currentConfig.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    // Clear any active demo role to ensure real Supabase session is used
    sessionStorage.removeItem('civicsync-demo-role');
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_KEY_KEY);
  }
}

export const STORAGE_BUCKET = 'report-media';
