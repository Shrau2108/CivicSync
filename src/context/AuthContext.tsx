import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';
import { DEMO_MODE, demoRoleProfile } from '@/lib/demoMode';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone?: string) => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  startDemoSession: (role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => void;
  demoMode: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const setDemoSession = useCallback((role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => {
    const demo = demoRoleProfile(role);
    const demoUser = { id: demo.id, email: demo.email, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: demo.created_at } as User;
    setUser(demoUser);
    setSession({ user: demoUser, access_token: 'demo-session', refresh_token: 'demo-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' } as Session);
    setProfile(demo);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      return;
    }
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    if (DEMO_MODE) {
      const savedRole = sessionStorage.getItem('civicsync-demo-role') as 'citizen' | 'supervisor' | 'volunteer' | 'admin' | null;
      if (savedRole) setDemoSession(savedRole);
      setLoading(false);
      return;
    }
    let mounted = true;

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfile(session.user.id);
      if (mounted) setLoading(false);
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(true);
      if (session?.user) {
        void fetchProfile(session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile, setDemoSession]);

  const signIn = async (email: string, password: string) => {
    if (DEMO_MODE) {
      const role = email.includes('supervisor') ? 'supervisor' : email.includes('volunteer') ? 'volunteer' : email.includes('admin') ? 'admin' : 'citizen';
      sessionStorage.setItem('civicsync-demo-role', role);
      setDemoSession(role);
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? formatAuthError(error.message) : null };
  };

  const startDemoSession = (role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => {
    sessionStorage.setItem('civicsync-demo-role', role);
    window.location.reload();
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    phone?: string
  ) => {
    if (DEMO_MODE) {
      sessionStorage.setItem('civicsync-demo-role', 'citizen');
      setDemoSession('citizen');
      return { error: null };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          phone: phone || undefined,
        },
      },
    });
    if (error) return { error: formatAuthError(error.message) };
    if (data.user) {
      await fetchProfile(data.user.id);
    }
    if (!data.session) {
      return { error: null, message: 'Account created. Check your email to confirm your account before signing in.' };
    }
    return { error: null };
  };

  const signOut = async () => {
    if (DEMO_MODE) {
      sessionStorage.removeItem('civicsync-demo-role');
      setProfile(null);
      setSession(null);
      setUser(null);
      window.location.reload();
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile, startDemoSession, demoMode: DEMO_MODE }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function formatAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Invalid email or password.';
  if (normalized.includes('user already registered')) return 'An account with this email already exists.';
  if (normalized.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (normalized.includes('password') && (normalized.includes('weak') || normalized.includes('least'))) {
    return 'Use at least 8 characters with an uppercase letter, a number, and a symbol, for example Demo2026!.';
  }
  return message;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
