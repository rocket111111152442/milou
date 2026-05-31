/**
 * Génère vercel-import.env depuis .env.local + valeurs Stripe / URL Vercel.
 * Usage : node scripts/prepare-vercel-env.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const localPath = resolve(root, '.env.local');
const outPath = resolve(root, 'vercel-import.env');

const REQUIRED_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_PRICE_LABEL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
];

const DEFAULTS = {
  NEXT_PUBLIC_APP_URL: 'https://milou-delta.vercel.app',
  STRIPE_PRICE_ID: 'price_1TckbB2fqOd9ClAbeX1JE9KZ',
  NEXT_PUBLIC_STRIPE_PRICE_LABEL: '4,99 € / mois',
};

function parseEnv(content) {
  const map = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

function formatValue(key, val) {
  if (!val) return '';
  if (key === 'FIREBASE_PRIVATE_KEY') {
    const oneLine = val.includes('\\n') ? val : val.replace(/\r?\n/g, '\\n');
    return `"${oneLine}"`;
  }
  if (val.includes(' ') || val.includes('€')) {
    return `"${val}"`;
  }
  return val;
}

if (!existsSync(localPath)) {
  console.error('❌ Fichier introuvable : frontend/.env.local');
  console.error('   Créez-le d’abord (copiez .env.vercel.template et remplissez).');
  process.exit(1);
}

const local = parseEnv(readFileSync(localPath, 'utf8'));
const merged = { ...DEFAULTS, ...local };

const lines = [
  '# Généré par npm run env:vercel — à importer sur Vercel (ne pas committer)',
  `# ${new Date().toISOString()}`,
  '',
];

const missing = [];
for (const key of REQUIRED_KEYS) {
  const val = merged[key] ?? DEFAULTS[key] ?? '';
  if (!val) missing.push(key);
  lines.push(`${key}=${formatValue(key, val)}`);
}

writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

console.log('✅ Fichier créé : frontend/vercel-import.env');
console.log('');
console.log('Prochaines étapes :');
console.log('  1. Ouvrez vercel-import.env et vérifiez STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET');
console.log('  2. Vercel → milou → Settings → Environment Variables');
console.log('  3. Bouton « Import » / « Import .env » → choisir vercel-import.env');
console.log('  4. Environnements : Production + Preview → Import');
console.log('  5. Deployments → Redeploy');
console.log('');

if (missing.length) {
  console.warn('⚠️  Variables encore vides dans .env.local :');
  missing.forEach((k) => console.warn(`   - ${k}`));
}
