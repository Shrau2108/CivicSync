import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';
import { DEMO_MODE, demoRoleProfile } from '@/lib/demoMode';

export interface RoleChangeNotice {
  fromRole: UserRole;
  toRole: UserRole;
  redirectUrl: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; profile?: Profile | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone?: string) => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  startDemoSession: (role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => void;
  exitDemoSession: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  isPasswordRecovery: boolean;
  roleChangeNotice: RoleChangeNotice | null;
  clearRoleChangeNotice: () => void;
  demoMode: boolean;
  isSupabaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function buildFallbackProfile(user: User): Profile {
  const meta = user.user_metadata || {};
  const role: UserRole = (meta.role as UserRole) || 'citizen';
  const fullName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    user.email?.split('@')[0] ||
    'Civic User';
  return {
    id: user.id,
    email: user.email || 'user@civicsync.in',
    full_name: fullName,
    phone: (meta.phone as string) || null,
    role,
    avatar_url: (meta.avatar_url as string) || null,
    is_active: true,
    created_at: user.created_at || new Date().toISOString(),
    updated_at: user.updated_at || user.created_at || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [roleChangeNotice, setRoleChangeNotice] = useState<RoleChangeNotice | null>(null);

  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const checkAndRecordRole = useCallback((newProfile: Profile): RoleChangeNotice | null => {
    if (typeof window === 'undefined') return null;
    const storageKey = `civicsync_active_role_${newProfile.id}`;
    const previousRole = localStorage.getItem(storageKey) as UserRole | null;

    if (previousRole && previousRole !== newProfile.role) {
      const redirectMap: Record<UserRole, string> = {
        citizen: '/app/citizen',
        volunteer: '/app/volunteer',
        supervisor: '/app/supervisor',
        admin: '/app/admin',
      };
      const notice: RoleChangeNotice = {
        fromRole: previousRole,
        toRole: newProfile.role,
        redirectUrl: redirectMap[newProfile.role] || '/app',
      };
      setRoleChangeNotice(notice);
      localStorage.setItem(storageKey, newProfile.role);
      return notice;
    }

    localStorage.setItem(storageKey, newProfile.role);
    return null;
  }, []);

  const clearRoleChangeNotice = useCallback(() => {
    setRoleChangeNotice(null);
  }, []);

  const setDemoSession = useCallback((role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => {
    const demo = demoRoleProfile(role);
    const demoUser = {
      id: demo.id,
      email: demo.email,
      app_metadata: {},
      user_metadata: { full_name: demo.full_name, role: demo.role },
      aud: 'authenticated',
      created_at: demo.created_at,
    } as User;
    setUser(demoUser);
    setSession({
      user: demoUser,
      access_token: 'demo-session',
      refresh_token: 'demo-refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
    } as Session);
    setProfile(demo);
  }, []);

  const fetchProfile = useCallback(
    async (userId: string, retries = 2, fallbackUser?: User | null): Promise<Profile | null> => {
      if (!isSupabaseConfigured) return null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (!error && data) {
            const loadedProfile = data as Profile;
            checkAndRecordRole(loadedProfile);
            setProfile(loadedProfile);

            // Synchronize auth.users user_metadata if role differs (e.g. upgraded to admin)
            const target = fallbackUser || userRef.current;
            if (target && target.user_metadata?.role !== loadedProfile.role) {
              void supabase.auth.updateUser({
                data: { role: loadedProfile.role, full_name: loadedProfile.full_name }
              }).catch(() => {});
            }

            return loadedProfile;
          }
        } catch (err) {
          console.warn(`Error fetching profile:`, err);
        }

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // If DB record not found, synthesize a fallback profile to prevent blocking the user
      const targetUser = fallbackUser || userRef.current;
      if (targetUser && targetUser.id === userId) {
        const fallback = buildFallbackProfile(targetUser);
        checkAndRecordRole(fallback);
        setProfile(fallback);
        return fallback;
      }

      return null;
    },
    [checkAndRecordRole]
  );

  useEffect(() => {
    // Safety timeout: ensure loading is NEVER stuck on true
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // Check if URL hash indicates password recovery
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsPasswordRecovery(true);
    }

    // If Supabase is not configured, fall back immediately to demo if present
    if (!isSupabaseConfigured) {
      const savedRole =
        typeof window !== 'undefined'
          ? (sessionStorage.getItem('civicsync-demo-role') as 'citizen' | 'supervisor' | 'volunteer' | 'admin' | null)
          : null;
      if (savedRole) {
        setDemoSession(savedRole);
      }
      setLoading(false);
      clearTimeout(safetyTimer);
      return;
    }

    // Live Supabase Session Handling (Checked FIRST - real users always take priority!)
    let mounted = true;
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtimeWatch = (userId: string) => {
      try {
        realtimeChannel = supabase
          .channel(`profile-watch-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${userId}`,
            },
            (payload) => {
              const updated = payload.new as Profile;
              if (updated && updated.role) {
                checkAndRecordRole(updated);
                setProfile(updated);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription:', err);
      }
    };

    const loadSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (initialSession?.user) {
          // A real user is logged in: clear any temporary demo flags
          sessionStorage.removeItem('civicsync-demo-role');
          setSession(initialSession);
          setUser(initialSession.user);

          // Immediately set initial fallback from metadata so user is never stalled
          const immediateFallback = buildFallbackProfile(initialSession.user);
          setProfile((prev) => prev ?? immediateFallback);

          setupRealtimeWatch(initialSession.user.id);
          // Load live profile from database to get the accurate role (e.g. admin)
          await fetchProfile(initialSession.user.id, 2, initialSession.user);
        } else {
          // No live Supabase session: check if user clicked a quick demo preview
          const savedRole =
            typeof window !== 'undefined'
              ? (sessionStorage.getItem('civicsync-demo-role') as 'citizen' | 'supervisor' | 'volunteer' | 'admin' | null)
              : null;
          if (savedRole) {
            setDemoSession(savedRole);
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('Session loading error:', err);
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      if (newSession?.user) {
        sessionStorage.removeItem('civicsync-demo-role');
        setSession(newSession);
        setUser(newSession.user);

        const immediateFallback = buildFallbackProfile(newSession.user);
        setProfile((prev) => prev ?? immediateFallback);

        setupRealtimeWatch(newSession.user.id);
        try {
          await fetchProfile(newSession.user.id, 2, newSession.user);
        } finally {
          if (mounted) setLoading(false);
          clearTimeout(safetyTimer);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        if (mounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      authListener.subscription.unsubscribe();
      if (realtimeChannel) realtimeChannel.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null; profile?: Profile | null }> => {
    // If user clicked quick demo or typed a demo.local email
    if (email.endsWith('@demo.local') || (!isSupabaseConfigured && !password)) {
      const role = email.includes('supervisor') ? 'supervisor' : email.includes('volunteer') ? 'volunteer' : email.includes('admin') ? 'admin' : 'citizen';
      sessionStorage.setItem('civicsync-demo-role', role);
      setDemoSession(role);
      return { error: null, profile: demoRoleProfile(role) };
    }

    if (!isSupabaseConfigured) {
      const lower = email.toLowerCase();
      if (lower.includes('admin')) {
        sessionStorage.setItem('civicsync-demo-role', 'admin');
        setDemoSession('admin');
        return { error: null };
      }
      if (lower.includes('supervisor')) {
        sessionStorage.setItem('civicsync-demo-role', 'supervisor');
        setDemoSession('supervisor');
        return { error: null };
      }
      if (lower.includes('volunteer')) {
        sessionStorage.setItem('civicsync-demo-role', 'volunteer');
        setDemoSession('volunteer');
        return { error: null };
      }
      if (lower.includes('citizen') || lower.includes('test')) {
        sessionStorage.setItem('civicsync-demo-role', 'citizen');
        setDemoSession('citizen');
        return { error: null };
      }

      return {
        error: 'Supabase credentials are not configured yet. Configure your Supabase URL & Anon Key in .env or the setup dialog, or use Quick Demo Login.',
      };
    }

    try {
      sessionStorage.removeItem('civicsync-demo-role');
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { error: formatAuthError(error.message) };

      if (data.user) {
        setUser(data.user);
        const liveProfile = await fetchProfile(data.user.id, 1, data.user);
        const active = liveProfile || buildFallbackProfile(data.user);
        setProfile(active);
        return { error: null, profile: active };
      }
      return { error: null, profile: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'An unexpected error occurred during sign in.' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    phone?: string
  ): Promise<{ error: string | null; message?: string }> => {
    if (!isSupabaseConfigured) {
      return {
        error: 'Supabase is not configured yet. Please configure your Supabase URL and Anon Key in .env to register live users, or use Demo Login.',
      };
    }

    try {
      sessionStorage.removeItem('civicsync-demo-role');
      const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName.trim(),
            role,
            phone: phone?.trim() || undefined,
          },
        },
      });

      if (error) return { error: formatAuthError(error.message) };

      if (data.user) {
        const fallback = buildFallbackProfile(data.user);
        if (fullName) fallback.full_name = fullName.trim();
        if (role) fallback.role = role;
        if (phone) fallback.phone = phone.trim();
        checkAndRecordRole(fallback);
        setProfile(fallback);
        await fetchProfile(data.user.id, 1, data.user);
      }

      if (!data.session) {
        return {
          error: null,
          message: 'Account created! Please check your email inbox to verify your email address before signing in.',
        };
      }

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to register account.' };
    }
  };

  const startDemoSession = (role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => {
    sessionStorage.setItem('civicsync-demo-role', role);
    setDemoSession(role);
  };

  const exitDemoSession = async () => {
    sessionStorage.removeItem('civicsync-demo-role');
    setProfile(null);
    setSession(null);
    setUser(null);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch(() => {});
    }
  };

  const signOut = async () => {
    if (user) {
      localStorage.removeItem(`civicsync_active_role_${user.id}`);
    }
    sessionStorage.removeItem('civicsync-demo-role');
    setProfile(null);
    setSession(null);
    setUser(null);
    setRoleChangeNotice(null);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch(() => {});
    }
  };

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase is not configured. Reset password requires an active Supabase project.' };
    }
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { error: formatAuthError(error.message) };
    return { error: null };
  };

  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase is not configured.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: formatAuthError(error.message) };
    setIsPasswordRecovery(false);
    return { error: null };
  };

  const refreshProfile = async () => {
    if (user && isSupabaseConfigured) {
      await fetchProfile(user.id, 2, user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        startDemoSession,
        exitDemoSession,
        resetPassword,
        updatePassword,
        isPasswordRecovery,
        roleChangeNotice,
        clearRoleChangeNotice,
        demoMode: DEMO_MODE,
        isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function formatAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Invalid email or password.';
  if (normalized.includes('user already registered')) return 'An account with this email already exists.';
  if (normalized.includes('email not confirmed')) return 'Please check your email and click the confirmation link before signing in.';
  if (normalized.includes('password') && (normalized.includes('weak') || normalized.includes('least'))) {
    return 'Password should be at least 8 characters with letters, numbers, and symbols.';
  }
  return message;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
