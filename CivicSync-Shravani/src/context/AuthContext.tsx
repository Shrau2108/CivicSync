import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Profile, UserRole } from '@/types';
import { DEMO_MODE, demoRoleProfile } from '@/lib/demoMode';
import { supabase } from '@/lib/supabase';
import {
  auth as firebaseAuth,
  db as firestoreDb,
  doc,
  getDoc,
  setDoc,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  updateFirebaseProfile,
  sendPasswordResetEmail,
  googleProvider,
  isFirebaseConfigured,
  type FirebaseUser,
} from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';

export interface AppUser {
  id: string;
  email: string | null;
  full_name?: string | null;
  role?: UserRole;
  [key: string]: unknown;
}

export interface AppSession {
  user: AppUser;
  access_token: string;
  expires_at?: number;
}

interface AuthContextValue {
  session: AppSession | null;
  user: AppUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone?: string) => Promise<{ error: string | null; message?: string }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  startDemoSession: (role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => void;
  demoMode: boolean;
  authProvider: 'firebase' | 'supabase' | 'demo';
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const authProvider: 'firebase' | 'supabase' | 'demo' = DEMO_MODE
    ? 'demo'
    : isFirebaseConfigured
    ? 'firebase'
    : 'supabase';

  const setDemoSession = useCallback((role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => {
    const demo = demoRoleProfile(role);
    const demoUser: AppUser = {
      id: demo.id,
      email: demo.email,
      full_name: demo.full_name,
      role: demo.role,
    };
    setUser(demoUser);
    setSession({
      user: demoUser,
      access_token: 'demo-session-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    setProfile(demo);
  }, []);

  // Fetch or create profile in Firestore or Supabase
  const fetchProfile = useCallback(async (userId: string, email?: string | null, fullName?: string | null) => {
    if (authProvider === 'firebase') {
      try {
        const profileRef = doc(firestoreDb, 'profiles', userId);
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          setProfile(snap.data() as Profile);
          return snap.data() as Profile;
        } else {
          // Auto-initialize profile in Firestore if it doesn't exist yet
          const now = new Date().toISOString();
          const newProfile: Profile = {
            id: userId,
            email: email || '',
            full_name: fullName || email?.split('@')[0] || 'Civic User',
            phone: null,
            role: 'citizen',
            avatar_url: null,
            is_active: true,
            created_at: now,
            updated_at: now,
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
          return newProfile;
        }
      } catch (err) {
        console.error('Error fetching Firebase profile:', err);
        // Fallback local profile
        const now = new Date().toISOString();
        const fallback: Profile = {
          id: userId,
          email: email || '',
          full_name: fullName || 'Civic User',
          phone: null,
          role: 'citizen',
          avatar_url: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        };
        setProfile(fallback);
        return fallback;
      }
    } else {
      // Supabase fetch
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('Error fetching Supabase profile:', error);
        setProfile(null);
        return null;
      }
      setProfile(data as Profile | null);
      return data as Profile | null;
    }
  }, [authProvider]);

  useEffect(() => {
    if (DEMO_MODE) {
      const savedRole = sessionStorage.getItem('civicsync-demo-role') as 'citizen' | 'supervisor' | 'volunteer' | 'admin' | null;
      if (savedRole) setDemoSession(savedRole);
      setLoading(false);
      return;
    }

    let mounted = true;

    if (authProvider === 'firebase') {
      // Firebase Auth Listener
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser: FirebaseUser | null) => {
        if (!mounted) return;
        if (fbUser) {
          const appUser: AppUser = {
            id: fbUser.uid,
            email: fbUser.email,
            full_name: fbUser.displayName,
          };
          const token = await fbUser.getIdToken();
          setSession({ user: appUser, access_token: token });
          setUser(appUser);
          await fetchProfile(fbUser.uid, fbUser.email, fbUser.displayName);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        if (mounted) setLoading(false);
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } else {
      // Supabase Auth Listener
      const loadSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          const appUser: AppUser = {
            id: session.user.id,
            email: session.user.email ?? null,
            full_name: (session.user.user_metadata?.full_name as string) || null,
          };
          setSession({ user: appUser, access_token: session.access_token });
          setUser(appUser);
          await fetchProfile(session.user.id);
        }
        if (mounted) setLoading(false);
      };

      void loadSession();

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const appUser: AppUser = {
            id: session.user.id,
            email: session.user.email ?? null,
            full_name: (session.user.user_metadata?.full_name as string) || null,
          };
          setSession({ user: appUser, access_token: session.access_token });
          setUser(appUser);
          void fetchProfile(session.user.id).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      });

      return () => {
        mounted = false;
        authListener.subscription.unsubscribe();
      };
    }
  }, [authProvider, fetchProfile, setDemoSession]);

  const signIn = async (email: string, password: string) => {
    if (DEMO_MODE) {
      const role = email.includes('supervisor') ? 'supervisor' : email.includes('volunteer') ? 'volunteer' : email.includes('admin') ? 'admin' : 'citizen';
      sessionStorage.setItem('civicsync-demo-role', role);
      setDemoSession(role);
      return { error: null };
    }

    if (authProvider === 'firebase') {
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const fbUser = cred.user;
        const appUser: AppUser = { id: fbUser.uid, email: fbUser.email, full_name: fbUser.displayName };
        const token = await fbUser.getIdToken();
        setUser(appUser);
        setSession({ user: appUser, access_token: token });
        await fetchProfile(fbUser.uid, fbUser.email, fbUser.displayName);
        return { error: null };
      } catch (err: unknown) {
        return { error: formatAuthError(err instanceof Error ? err.message : String(err)) };
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? formatAuthError(error.message) : null };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    phone?: string
  ) => {
    if (DEMO_MODE) {
      sessionStorage.setItem('civicsync-demo-role', role);
      setDemoSession(role);
      return { error: null };
    }

    if (authProvider === 'firebase') {
      try {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        await updateFirebaseProfile(cred.user, { displayName: fullName });

        // Save complete profile in Firestore
        const now = new Date().toISOString();
        const profileData: Profile = {
          id: cred.user.uid,
          email,
          full_name: fullName,
          phone: phone || null,
          role,
          avatar_url: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        };
        try {
          await setDoc(doc(firestoreDb, 'profiles', cred.user.uid), profileData);
        } catch (dbErr) {
          console.warn('Could not write profile to Firestore:', dbErr);
        }

        const appUser: AppUser = { id: cred.user.uid, email: cred.user.email, full_name: fullName };
        const token = await cred.user.getIdToken();
        setUser(appUser);
        setSession({ user: appUser, access_token: token });
        setProfile(profileData);
        return { error: null };
      } catch (err: unknown) {
        return { error: formatAuthError(err instanceof Error ? err.message : String(err)) };
      }
    } else {
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
    }
  };

  const signInWithGoogle = async () => {
    if (DEMO_MODE) {
      setDemoSession('citizen');
      return { error: null };
    }

    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const fbUser = result.user;
      const appUser: AppUser = { id: fbUser.uid, email: fbUser.email, full_name: fbUser.displayName };
      const token = await fbUser.getIdToken();
      setUser(appUser);
      setSession({ user: appUser, access_token: token });
      await fetchProfile(fbUser.uid, fbUser.email, fbUser.displayName);
      return { error: null };
    } catch (err: unknown) {
      return { error: formatAuthError(err instanceof Error ? err.message : String(err)) };
    }
  };

  const resetPassword = async (email: string) => {
    if (authProvider === 'firebase') {
      try {
        await sendPasswordResetEmail(firebaseAuth, email);
        return { error: null };
      } catch (err: unknown) {
        return { error: formatAuthError(err instanceof Error ? err.message : String(err)) };
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error ? error.message : null };
    }
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

    if (authProvider === 'firebase') {
      await firebaseSignOut(firebaseAuth);
    } else {
      await supabase.auth.signOut();
    }

    setProfile(null);
    setSession(null);
    setUser(null);
  };

  const startDemoSession = (role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => {
    sessionStorage.setItem('civicsync-demo-role', role);
    window.location.reload();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user.email, user.full_name);
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
        signInWithGoogle,
        resetPassword,
        signOut,
        refreshProfile,
        startDemoSession,
        demoMode: DEMO_MODE,
        authProvider,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function formatAuthError(message: string): string {
  const normalized = message.toLowerCase();
  // Firebase specific errors
  if (normalized.includes('auth/invalid-credential') || normalized.includes('auth/wrong-password') || normalized.includes('auth/user-not-found')) {
    return 'Invalid email or password.';
  }
  if (normalized.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists.';
  }
  if (normalized.includes('auth/weak-password')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (normalized.includes('auth/invalid-api-key')) {
    return 'Invalid Firebase API Key. Please verify VITE_FIREBASE_API_KEY in your .env.local or Vercel settings.';
  }
  if (normalized.includes('auth/popup-closed-by-user')) {
    return 'Google Sign-In was cancelled.';
  }
  // Supabase specific errors
  if (normalized.includes('invalid api key')) {
    return 'Invalid API Key: Please verify your Firebase/Supabase environment variables.';
  }
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
