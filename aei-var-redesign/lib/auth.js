// Comptes administrateurs, mots de passe et sessions
import { scrypt as scryptCb, randomBytes, timingSafeEqual, createHmac, createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { readJSON, updateJSON } from './storage.js';
import { HttpError, parseCookies } from './http.js';

const scrypt = promisify(scryptCb);
const USERS_KEY = 'auth/users.json';
const COOKIE = 'aei_session';
const SESSION_HOURS = 8;
export const ROLES = ['owner', 'admin', 'agent'];
export const ROLE_LABELS = { owner: 'Propriétaire', admin: 'Administrateur', agent: 'Négociateur' };

export const MIN_PASSWORD = 10;
export function checkPasswordStrength(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) throw new HttpError(400, `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
  if (pw.length > 200) throw new HttpError(400, 'Mot de passe trop long.');
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) throw new HttpError(400, 'Le mot de passe doit contenir des lettres et des chiffres.');
}

// Hachage scrypt (N=16384) avec sel aléatoire
export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const [algo, saltB64, keyB64] = String(stored || '').split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(String(pw), Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(key, expected);
}

export const readUsers = () => readJSON(USERS_KEY, []);
export const updateUsers = (fn) => updateJSON(USERS_KEY, [], fn);

export const publicUser = (u) => u && ({
  id: u.id, email: u.email, name: u.name, role: u.role, roleLabel: ROLE_LABELS[u.role],
  disabled: !!u.disabled, mustChange: !!u.mustChange, createdAt: u.createdAt, lastLogin: u.lastLogin || null,
});

export const newUserId = () => randomUUID();

// ---------- Sessions : cookie signé HMAC, HttpOnly, SameSite=Strict ----------
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new HttpError(500, 'SESSION_SECRET manquant ou trop court (32 caractères minimum).');
  return s;
}
const sign = (data) => createHmac('sha256', secret()).update(data).digest('base64url');

export function sessionCookie(user, request) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, v: user.sessionVersion || 0, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString('base64url');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

// Retourne l'utilisateur connecté, ou lève 401
export async function requireUser(request, roles = ROLES) {
  const raw = parseCookies(request)[COOKIE];
  if (!raw) throw new HttpError(401, 'Connexion requise');
  const [payload, sig] = raw.split('.');
  const expected = sign(payload);
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new HttpError(401, 'Session invalide');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new HttpError(401, 'Session invalide'); }
  if (!data.exp || data.exp < Date.now()) throw new HttpError(401, 'Session expirée, reconnectez-vous');
  const user = (await readUsers()).find(u => u.id === data.uid);
  if (!user || user.disabled || (user.sessionVersion || 0) !== data.v) throw new HttpError(401, 'Session expirée, reconnectez-vous');
  if (!roles.includes(user.role)) throw new HttpError(403, 'Vous n’avez pas les droits pour cette action');
  return user;
}

// Jetons de réinitialisation : seul leur hachage est stocké
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (t) => createHash('sha256').update(String(t)).digest('hex');
