// Mesure d'audience maison : compteurs agrégés par jour, SANS cookie, SANS adresse IP, SANS identifiant de visiteur.
// On ne sait donc compter que des pages vues (pas des visiteurs uniques). Voir la page Cookies pour l'information du public.
import { updateJSON, readJSON, listKeys, removeKeys } from './storage.js';

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|node-fetch/i;
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

export async function recordHit({ path, referrer, lang, userAgent }) {
  if (BOT.test(userAgent || '')) return false;
  const n = normalizePath(path);
  if (!n) return false;
  let ref = '';
  try { if (referrer) ref = new URL(referrer).hostname.replace(/^www\./, '').slice(0, 60); } catch {}
  const day = today();
  await updateJSON(monthKey(day), { days: {} }, (data) => {
    const d = (data.days[day] ||= { total: 0, pages: {}, biens: {}, refs: {}, langs: {} });
    d.total++;
    d.pages[n.page] = (d.pages[n.page] || 0) + 1;
    if (n.bien) d.biens[n.bien] = (d.biens[n.bien] || 0) + 1;
    if (ref) d.refs[ref] = (d.refs[ref] || 0) + 1;
    const l = ['fr', 'en', 'de'].includes(lang) ? lang : 'fr';
    d.langs[l] = (d.langs[l] || 0) + 1;
    return data;
  }, 6);
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
