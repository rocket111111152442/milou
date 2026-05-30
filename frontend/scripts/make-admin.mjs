import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const email = process.argv[2]?.toLowerCase();
const password = process.argv[3];

if (!email) {
  console.error('Usage: node scripts/make-admin.mjs <email> [password]');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Variables FIREBASE_* manquantes dans .env.local');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const auth = getAuth();
const db = getFirestore();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch (e) {
  if (e.code === 'auth/user-not-found' && password) {
    user = await auth.createUser({ email, password, emailVerified: true });
    console.log('Compte Auth créé:', user.uid);
  } else {
    throw e;
  }
}

const ref = db.collection('users').doc(user.uid);
const snap = await ref.get();

if (snap.exists) {
  await ref.update({ role: 'admin' });
} else {
  await ref.set({
    firstname: 'Admin',
    lastname: 'MILOU',
    email,
    balance: 1000,
    role: 'admin',
    reputation: 100,
    totalEarned: 1000,
    totalSpent: 0,
    transactionCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
}

console.log('OK —', email, 'est maintenant admin (uid:', user.uid + ')');
