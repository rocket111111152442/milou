// Connexion, déconnexion, mot de passe
import { timingSafeEqual, createHash } from 'node:crypto';
import { json, readBody, clientIp, HttpError } from '../http.js';
import {
  readUsers, updateUsers, verifyPassword, hashPassword, checkPasswordStrength, publicUser,
  sessionCookie, clearCookie, requireUser, newUserId, newToken, tokenHash,
} from '../auth.js';
import { rateLimit, assertNotLocked, recordFailure, clearFailures } from '../ratelimit.js';
import { readJSON, writeJSON, removeKeys } from '../storage.js';
import { sendEmail, emailEnabled, layout } from '../email.js';
import agence from '../../config/agence.js';

const same = (a, b) => {
  const x = createHash('sha256').update(String(a)).digest(), y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
};

async function login({ request }) {
  const body = await readBody(request, 5000);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(400, 'E-mail et mot de passe requis');
  await rateLimit('login-ip', clientIp(request), 30, 3600);
  await assertNotLocked(email);

  let users = await readUsers();
  let user = users.find(u => u.email === email);

  // Premier démarrage : aucun compte → le compte propriétaire est créé à partir de ADMIN_EMAIL / ADMIN_PASSWORD
  if (!users.length) {
    const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envPw = process.env.ADMIN_PASSWORD || '';
    if (!envEmail || !envPw) throw new HttpError(503, 'Aucun compte configuré : définissez ADMIN_EMAIL et ADMIN_PASSWORD.');
    if (same(email, envEmail) && same(password, envPw)) {
      const owner = { id: newUserId(), email, name: (process.env.ADMIN_NAME || 'Propriétaire').slice(0, 80), role: 'owner', hash: await hashPassword(password), mustChange: true, sessionVersion: 0, createdAt: new Date().toISOString() };
      users = await updateUsers(list => (list.length ? list : [owner]));
      user = users.find(u => u.email === email);
    }
  }

  const ok = user && !user.disabled && await verifyPassword(password, user.hash);
  if (!ok) {
    await recordFailure(email);
    throw new HttpError(401, 'E-mail ou mot de passe incorrect');
  }
  await clearFailures(email);
  await updateUsers(list => list.map(u => (u.id === user.id ? { ...u, lastLogin: new Date().toISOString() } : u)));
  return json({ user: publicUser(user) }, 200, { 'set-cookie': sessionCookie(user, request) });
}

async function logout() {
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}

async function me({ request }) {
  const user = await requireUser(request, undefined, { allowMustChange: true });
  return json({ user: publicUser(user), emailEnabled: emailEnabled() });
}

async function changePassword({ request }) {
  const user = await requireUser(request, undefined, { allowMustChange: true });
  const { current, next } = await readBody(request, 5000);
  if (!(await verifyPassword(current, user.hash))) throw new HttpError(400, 'Mot de passe actuel incorrect');
  checkPasswordStrength(next);
  if (current === next) throw new HttpError(400, 'Choisissez un mot de passe différent de l’actuel');
  const hash = await hashPassword(next);
  const users = await updateUsers(list => list.map(u => (u.id === user.id ? { ...u, hash, mustChange: false, sessionVersion: (u.sessionVersion || 0) + 1 } : u)));
  const updated = users.find(u => u.id === user.id);
  // Les autres sessions sont déconnectées, celle-ci reçoit un nouveau cookie
  return json({ user: publicUser(updated) }, 200, { 'set-cookie': sessionCookie(updated, request) });
}

// Mot de passe oublié : réponse identique que le compte existe ou non (pas de fuite d'information)
async function forgot({ request }) {
  const { email } = await readBody(request, 2000);
  await rateLimit('forgot', clientIp(request), 5, 3600);
  const generic = json({ ok: true, message: emailEnabled()
    ? 'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé (valable 30 minutes).'
    : 'L’envoi d’e-mails n’est pas encore configuré : demandez à un administrateur de réinitialiser votre mot de passe.' });
  const user = (await readUsers()).find(u => u.email === String(email || '').trim().toLowerCase() && !u.disabled);
  if (!user || !emailEnabled()) return generic;

  const token = newToken();
  await writeJSON(`auth/resets/${tokenHash(token)}.json`, { uid: user.id, exp: Date.now() + 30 * 60000 });
  const link = `${new URL(request.url).origin}/admin/#reset=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe',
    text: `Bonjour ${user.name},\n\nUne réinitialisation du mot de passe de votre accès administrateur ${agence.nomCourt} a été demandée.\nCe lien est valable 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.`,
    html: layout('Réinitialisation de votre mot de passe', `Bonjour ${user.name},\n\nUne réinitialisation du mot de passe de votre accès administrateur ${agence.nomCourt} a été demandée.\nCe lien est valable 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.`, { url: link, label: 'Choisir un nouveau mot de passe' }),
  });
  return generic;
}

async function reset({ request }) {
  const { token, password } = await readBody(request, 5000);
  await rateLimit('reset', clientIp(request), 10, 3600);
  if (!token || typeof token !== 'string' || token.length > 100) throw new HttpError(400, 'Lien invalide');
  const key = `auth/resets/${tokenHash(token)}.json`;
  const entry = await readJSON(key);
  if (!entry || entry.exp < Date.now()) throw new HttpError(400, 'Ce lien a expiré. Refaites une demande.');
  checkPasswordStrength(password);
  const hash = await hashPassword(password);
  await updateUsers(list => list.map(u => (u.id === entry.uid ? { ...u, hash, mustChange: false, sessionVersion: (u.sessionVersion || 0) + 1 } : u)));
  await removeKeys(key);
  return json({ ok: true });
}

export default [
  ['POST', '/auth/login', login],
  ['POST', '/auth/logout', logout],
  ['GET', '/auth/me', me],
  ['POST', '/auth/password', changePassword],
  ['POST', '/auth/forgot', forgot],
  ['POST', '/auth/reset', reset],
];
