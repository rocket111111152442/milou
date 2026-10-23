// Mesure d'audience maison : compteurs agrégés par jour, SANS cookie, SANS adresse IP, SANS identifiant de visiteur.
// On ne sait donc compter que des pages vues (pas des visiteurs uniques). Voir la page Cookies pour l'information du public.
import { updateJSON, readJSON, listKeys, removeKeys } from './storage.js';

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|node-fetch/i;
export const isBot = (ua) => BOT.test(ua || '');
const monthKey = (d) => `stats/${d.slice(0, 7)}.json`;
const today = () => new Date().toISOString().slice(0, 10);

// Normalise le chemin pour ne garder que des pages connues (évite de stocker des URL arbitraires)
export function normalizePath(path) {
  const p = String(path || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  let m;
  if ((m = p.match(/^\/bien\/([\w-]{1,60})$/))) return { page: '/bien', bien: m[1] };
  if ((m = p.match(/^\/immobilier\/([\w-]{1,60})$/))) return { page: '/immobilier/' + m[1] };
  const known = ['/', '/biens', '/espace-client.html', '/mentions-legales.html', '/confidentialite.html', '/cookies.html', '/honoraires.html', '/agences.html'];
  return known.includes(p) ? { page: p } : null;
}

// Les pages vues sont cumulées en mémoire et écrites au plus une fois par minute et par instance : cela évite une écriture
// de stockage à chaque visite (quota d'opérations du stockage). Conséquence assumée : la mesure est approximative
// (quelques vues peuvent se perdre quand une instance s'arrête avant d'avoir écrit).
let buffer = [];
let lastFlush = Date.now();
const FLUSH_MS = 60_000;

async function flush() {
  const items = buffer; buffer = []; lastFlush = Date.now();
  if (!items.length) return;
  const byMonth = new Map();
  for (const it of items) (byMonth.get(monthKey(it.day)) || byMonth.set(monthKey(it.day), []).get(monthKey(it.day))).push(it);
  for (const [key, list] of byMonth) {
    await updateJSON(key, { days: {} }, (data) => {
      for (const it of list) {
        const d = (data.days[it.day] ||= { total: 0, pages: {}, biens: {}, refs: {}, langs: {} });
        d.total++;
        d.pages[it.page] = (d.pages[it.page] || 0) + 1;
        if (it.bien) d.biens[it.bien] = (d.biens[it.bien] || 0) + 1;
        if (it.ref) d.refs[it.ref] = (d.refs[it.ref] || 0) + 1;
        d.langs[it.lang] = (d.langs[it.lang] || 0) + 1;
      }
      return data;
    }, 3);
  }
}

export async function recordHit({ path, referrer, lang, userAgent }) {
  if (isBot(userAgent)) return false;
  const n = normalizePath(path);
  if (!n) return false;
  let ref = '';
  try { if (referrer) ref = new URL(referrer).hostname.replace(/^www\./, '').slice(0, 60); } catch {}
  buffer.push({ day: today(), page: n.page, bien: n.bien, ref, lang: ['fr', 'en', 'de'].includes(lang) ? lang : 'fr' });
  if (Date.now() - lastFlush >= FLUSH_MS || buffer.length >= 50) await flush();
  return true;
}

export async function audience(days = 30) {
  const to = new Date();
  const months = new Set();
  for (let i = 0; i < days; i++) { const d = new Date(to - i * 864e5).toISOString().slice(0, 10); months.add(monthKey(d)); }
  const files = await Promise.all([...months].map(k => readJSON(k, { days: {} })));
  const merged = Object.assign({}, ...files.map(f => f.days));
  const out = { total: 0, parJour: [], pages: {}, biens: {}, refs: {}, langs: {} };
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(to - i * 864e5).toISOString().slice(0, 10);
    const d = merged[day];
    out.parJour.push({ day, count: d?.total || 0 });
    if (!d) continue;
    out.total += d.total;
    for (const k of ['pages', 'biens', 'refs', 'langs']) for (const [x, n] of Object.entries(d[k])) out[k][x] = (out[k][x] || 0) + n;
  }
  return out;
}

export async function purgeOld(months) {
  const limit = new Date(); limit.setMonth(limit.getMonth() - months);
  const old = (await listKeys('stats/')).filter(k => k.key.slice(6, 13) < limit.toISOString().slice(0, 7)).map(k => k.key);
  if (old.length) await removeKeys(old);
  return old.length;
}
