import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'civicsync_supabase_url';
const STORAGE_KEY_KEY = 'civicsync_supabase_anon_key';

function isValidSupabaseConfig(url: string | undefined, anonKey: string | undefined): url is string {
  if (!url || !anonKey) return false;
  const placeholders = /demo-placeholder|your-project|your-anon-public-key/i;
  if (placeholders.test(url) || placeholders.test(anonKey)) return false;

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'env' | 'localStorage' | 'none';
} {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (isValidSupabaseConfig(envUrl, envKey)) {
    return { url: envUrl.replace(/\/+$/, ''), anonKey: envKey!, isConfigured: true, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    try {
      const localUrl = localStorage.getItem(STORAGE_URL_KEY)?.trim();
      const localKey = localStorage.getItem(STORAGE_KEY_KEY)?.trim();
      if (isValidSupabaseConfig(localUrl, localKey)) {
        return { url: localUrl.replace(/\/+$/, ''), anonKey: localKey!, isConfigured: true, source: 'localStorage' };
      }
    } catch (err) {
      console.warn('Could not read saved Supabase configuration:', err);
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

export function hasSupabaseSessionForCurrentProject(): boolean {
  if (!isSupabaseConfigured || typeof window === 'undefined') return false;

  try {
    const projectRef = new URL(currentConfig.url).hostname.split('.')[0];
    const storedSession = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!storedSession) return false;

    const session = JSON.parse(storedSession) as { access_token?: unknown; user?: unknown };
    return typeof session.access_token === 'string' && Boolean(session.user);
  } catch (err) {
    console.warn('Could not read the current Supabase session:', err);
    return false;
  }
}

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

export async function checkSupabaseConnection(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase credentials are not configured.');
  }

  const { error } = await supabase
    .from('report_categories')
    .select('id')
    .limit(1);
  if (error) {
    throw new Error(`Supabase database check failed: ${error.message}`);
  }
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  const normalizedUrl = url.trim().replace(/\/+$/, '');
  const normalizedKey = anonKey.trim();
  if (!isValidSupabaseConfig(normalizedUrl, normalizedKey)) {
    throw new Error('Enter a valid Supabase project URL and anon/public key.');
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, normalizedUrl);
    localStorage.setItem(STORAGE_KEY_KEY, normalizedKey);
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
