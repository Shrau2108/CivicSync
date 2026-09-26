import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  sendPasswordResetEmail,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';

// ──────────────────────────────────────────────
// Firebase is used ONLY for Authentication.
// All data (profiles, reports, etc.) lives in Supabase.
// ──────────────────────────────────────────────

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-placeholder-api-key'
);

let app: FirebaseApp;
let auth: Auth;

if (!getApps().length) {
  app = initializeApp(
    isFirebaseConfigured
      ? firebaseConfig
      : {
          apiKey: 'demo-placeholder-api-key',
          authDomain: 'civicsync-demo.firebaseapp.com',
          projectId: 'civicsync-demo',
          storageBucket: 'civicsync-demo.appspot.com',
          messagingSenderId: '123456789',
          appId: '1:123456789:web:demo',
        }
  );
} else {
  app = getApp();
}

auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export {
  app,
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  updateFirebaseProfile,
  sendPasswordResetEmail,
};
export type { FirebaseUser };
