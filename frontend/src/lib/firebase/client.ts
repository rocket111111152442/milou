import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let clientApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

/** Message d’aide si Firebase manque (local vs Vercel). */
export function getFirebaseConfigError(): string {
  const onVercel =
    typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('.vercel.app') ||
      !window.location.hostname.includes('localhost'));

  if (onVercel) {
    return (
      'Firebase n’est pas configuré sur Vercel. ' +
      'Allez sur vercel.com → votre projet → Settings → Environment Variables, ' +
      'ajoutez toutes les variables NEXT_PUBLIC_FIREBASE_* (copiées depuis frontend/.env.local), ' +
      'cochez Production, puis Deployments → Redeploy.'
    );
  }
  return 'Firebase non configuré. Vérifiez frontend/.env.local puis redémarrez npm run dev.';
}

function getClientApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase uniquement dans le navigateur');
  }
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase non configuré');
  }
  if (!clientApp) {
    clientApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return clientApp;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getClientApp());
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getClientApp());
  }
  return db;
}
