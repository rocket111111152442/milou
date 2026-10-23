// Routes publiques du site (sans connexion)
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { json, readBody, readBinary, clientIp, HttpError, sniffImage } from '../http.js';
import { rateLimit } from '../ratelimit.js';
import { readBiens, readBiensPublic, publicBiens, publicBien } from '../biens.js';
import { sanitizeLead, createLead, TYPES, STATUSES, matchesTracking, findByCode, readLead, updateLead } from '../leads.js';
import { readBuffer, writeBuffer, moveKey } from '../storage.js';
import { sendEmail, emailEnabled, layout } from '../email.js';
import agence from '../../config/agence.js';
import { publicAvis } from '../avis.js';
import { readCommunes, indicative } from '../communes.js';
import { recordHit, isBot } from '../stats.js';
import { upsertFromLead } from '../crm.js';

const PUBLIC_CACHE = { 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' };

async function listPublic() {
  return json(publicBiens(await readBiensPublic()), 200, PUBLIC_CACHE);
}

async function getPublic({ params }) {
  const b = (await readBiensPublic()).find(x => x.id === params.id && x.publie);
  if (!b) throw new HttpError(404, 'Bien introuvable');
  return json(publicBien(b), 200, PUBLIC_CACHE);
}

async function config() {
  return json({
    nom: agence.nom, nomCourt: agence.nomCourt, adresse: agence.adresse, codePostal: agence.codePostal, ville: agence.ville,
    telephone: agence.telephone, email: agence.email, horaires: agence.horaires,
    legal: agence.legal, hebergeur: agence.hebergeur, conservation: agence.conservation,
    emailEnabled: emailEnabled(),
  }, 200, PUBLIC_CACHE);
}

// ---------- Photos jointes à une demande d'estimation ----------
// Le client reçoit un jeton signé : il ne peut joindre à sa demande que ses propres envois.
const sign = (key) => createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(`upload:${key}`).digest('base64url');
const validSig = (key, sig) => {
  const a = Buffer.from(sign(key)), b = Buffer.from(String(sig || ''));
  return a.length === b.length && timingSafeEqual(a, b);
};

async function uploadEstimationPhoto({ request }) {
  await rateLimit('upload-public', clientIp(request), 25, 3600);
  const buf = await readBinary(request, 4 * 1024 * 1024);
  const img = sniffImage(buf);
  if (!img) throw new HttpError(415, 'Format accepté : JPEG, PNG ou WebP');
  const key = `uploads/tmp/${Date.now()}-${randomBytes(9).toString('base64url')}.${img.ext}`;
  await writeBuffer(key, buf, img.type);
  return json({ key, sig: sign(key) });
}

// ---------- Réception d'une demande ----------
async function submitLead({ request }) {
  const body = await readBody(request, 30_000);
  // Pièges à robots : champ caché rempli, ou formulaire envoyé trop vite
  if (body.website) return json({ ok: true, code: null });
  if (typeof body.startedAt === 'number' && Date.now() - body.startedAt < 1500) throw new HttpError(400, 'Merci de vérifier le formulaire avant l’envoi');
  await rateLimit('lead', clientIp(request), 8, 3600);

  const clean = sanitizeLead(body);
  if (clean.bienId) {
    const bien = (await readBiensPublic()).find(b => b.id === clean.bienId && b.publie);
    clean.bienTitre = bien ? `${bien.titre} (${bien.ville}${bien.ref ? ', réf. ' + bien.ref : ''})` : '';
    if (!bien) clean.bienId = '';
  }

  // Photos d'estimation : 8 maximum, uniquement des envois signés
  const photosIn = clean.type === 'estimation' && Array.isArray(body.photos) ? body.photos.slice(0, 8) : [];
  const lead = await createLead(clean, { photos: [] });
  if (photosIn.length) {
    const photos = [];
    for (const p of photosIn) {
      if (typeof p?.key !== 'string' || !/^uploads\/tmp\/[\w-]+\.(jpg|png|webp)$/.test(p.key) || !validSig(p.key, p.sig)) continue;
      const dest = `leads-media/${lead.id}/${p.key.split('/').pop()}`;
      try { await moveKey(p.key, dest); photos.push({ key: dest }); } catch { /* fichier expiré : ignoré */ }
    }
    if (photos.length) await updateLead(lead.id, l => ({ ...l, photos }));
  }

  // Fiche contact (CRM) et assignation automatique au négociateur du bien
  const contactId = await upsertFromLead(lead).catch(e => { console.error('CRM', e); return null; });
  const nego = clean.bienId ? (await readBiens()).find(b => b.id === clean.bienId)?.negociateurId : '';
  if (contactId || nego) await updateLead(lead.id, l => ({ ...l, contactId: contactId || '', assigneId: nego || '' }));
  await notify(lead, request).catch(e => console.error('Notification échouée', e));
  return json({ ok: true, code: lead.code, emailSent: emailEnabled() && Boolean(lead.email) });
}

async function notify(lead, request) {
  if (!emailEnabled()) return;
  const origin = new URL(request.url).origin;
  const label = TYPES[lead.type];
  const to = process.env.NOTIFY_EMAIL || agence.email;
  const lines = [
    `Type : ${label}`, `Nom : ${lead.nom || '—'}`, `Téléphone : ${lead.tel || '—'}`, `E-mail : ${lead.email || '—'}`,
    lead.bienTitre && `Bien : ${lead.bienTitre}`,
    lead.details?.ville && `Ville : ${lead.details.ville}`, lead.details?.surface && `Surface : ${lead.details.surface} m²`,
    lead.details?.date && `Date souhaitée : ${lead.details.date} ${lead.details.creneau || ''}`,
    lead.message && `\nMessage :\n${lead.message}`,
  ].filter(Boolean).join('\n');
  await sendEmail({
    to, replyTo: lead.email || undefined,
    subject: `Nouvelle demande : ${label}${lead.nom ? ' – ' + lead.nom : ''}`,
    html: layout(`Nouvelle demande : ${label}`, lines, { url: `${origin}/admin/#demandes/${lead.id}`, label: 'Ouvrir dans l’admin' }),
    text: lines,
  });
  if (lead.email) {
    const txt = lead.type === 'alerte'
      ? `Votre alerte est enregistrée. Vous recevrez un e-mail lorsqu’un bien correspondant à vos critères sera publié.\nVous pouvez vous désinscrire à tout moment depuis le lien présent dans chaque alerte.`
      : `Bonjour ${lead.nom},\n\nNous avons bien reçu votre demande (${label.toLowerCase()}). Un membre de l’équipe vous recontacte rapidement.\n\nVotre code de suivi : ${lead.code}\nVous pouvez suivre l’avancement de votre demande depuis l’espace client du site.\n\n${agence.nom}\n${agence.telephone}`;
    await sendEmail({
      to: lead.email,
      subject: lead.type === 'alerte' ? 'Votre alerte immobilière est enregistrée' : `Nous avons bien reçu votre demande – ${agence.nomCourt}`,
      html: layout(lead.type === 'alerte' ? 'Alerte enregistrée' : 'Demande bien reçue', txt, { url: `${origin}/espace-client.html#suivi`, label: 'Suivre ma demande' }),
      text: txt,
    });
  }
}

// ---------- Suivi d'une demande par le client ----------
async function track({ request }) {
  await rateLimit('track', clientIp(request), 15, 3600);
  const { code, contact } = await readBody(request, 2000);
  const found = await findByCode(code);
  const lead = matchesTracking(found, code, contact) ? found : null;
  if (!lead) throw new HttpError(404, 'Aucune demande ne correspond à ce code et à ce contact.');
  return json({
    type: TYPES[lead.type], status: lead.status, statusLabel: STATUSES[lead.status],
    createdAt: lead.createdAt, updatedAt: lead.updatedAt, bien: lead.bienTitre || null,
  });
}

// ---------- Désinscription des alertes (lien dans chaque e-mail) ----------
async function unsubscribe({ query }) {
  const id = query.get('id') || '', token = query.get('token') || '';
  const lead = await readLead(id).catch(() => null);
  const ok = lead?.alert && Buffer.from(lead.alert.token).length === Buffer.from(token).length && timingSafeEqual(Buffer.from(lead.alert.token), Buffer.from(token));
  if (ok) await updateLead(id, l => ({ ...l, alert: { ...l.alert, active: false }, history: [...l.history, { at: new Date().toISOString(), by: 'client', action: 'Désinscription des alertes' }] }));
  return new Response(null, { status: 302, headers: { location: `/espace-client.html?desinscription=${ok ? 'ok' : 'erreur'}#alertes` } });
}

// ---------- Photos des biens (stockage privé, diffusées publiquement par cette route) ----------
async function media({ params }) {
  if (!/^[\w-]+\.(webp|jpe?g|png)$/i.test(params.file)) throw new HttpError(404, 'Introuvable');
  const buf = await readBuffer(`photos/${params.file}`);
  if (!buf) throw new HttpError(404, 'Introuvable');
  const img = sniffImage(buf);
  return new Response(buf, { headers: { 'content-type': img?.type || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
}

// ---------- Avis, communes, estimation indicative, mesure d'audience ----------
async function avis() { return json(await publicAvis({ tolerant: true }), 200, PUBLIC_CACHE); }

async function communesList() {
  const { communes } = await readCommunes({ tolerant: true });
  return json(communes.map(c => ({ slug: c.slug, nom: c.nom })), 200, PUBLIC_CACHE);
}

async function estimationIndicative({ request }) {
  await rateLimit('indicative', clientIp(request), 30, 3600);
  const { type, ville, surface } = await readBody(request, 2000);
  const r = await indicative({ typeBien: String(type || ''), ville: String(ville || ''), surface });
  return json({ indicative: r });
}

// Limite en mémoire (par instance) : la mesure d'audience ne doit jamais consommer d'opérations de stockage inutiles
const hitSeen = new Map();
async function statsHit({ request }) {
  const ua = request.headers.get('user-agent') || '';
  if (isBot(ua)) return new Response(null, { status: 204 });
  const ip = clientIp(request), now = Date.now();
  const rec = hitSeen.get(ip);
  if (rec && now - rec.t < 3_600_000 && rec.n >= 240) return new Response(null, { status: 204 });
  hitSeen.set(ip, !rec || now - rec.t >= 3_600_000 ? { t: now, n: 1 } : { t: rec.t, n: rec.n + 1 });
  if (hitSeen.size > 5000) hitSeen.clear();
  const { path, referrer, lang } = await readBody(request, 1000);
  await recordHit({ path, referrer, lang, userAgent: ua }).catch(e => console.error('Audience', e?.message));
  return new Response(null, { status: 204 });
}

export default [
  ['GET', '/avis', avis],
  ['GET', '/communes', communesList],
  ['POST', '/estimation/indicative', estimationIndicative],
  ['POST', '/stats/hit', statsHit],
  ['GET', '/biens', listPublic],
  ['GET', '/biens/:id', getPublic],
  ['GET', '/config', config],
  ['POST', '/leads', submitLead],
  ['POST', '/leads/photo', uploadEstimationPhoto],
  ['POST', '/suivi', track],
  ['GET', '/alertes/desinscription', unsubscribe],
  ['GET', '/media/photos/:file', media],
];
