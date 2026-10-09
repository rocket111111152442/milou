// Import du classement mondial des sites (liste Tranco, top 1M) et calcul des raretés.
// Tranco agrège plusieurs classements de trafic (Chrome UX, Cloudflare Radar, Umbrella...).
// Rang faible = site très visité = carte très rare.
import { inflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

export const TRANCO_URL = 'https://tranco-list.eu/top-1m.csv.zip';

// Paliers de rareté sur le rang (après filtrage). Index = id de rareté.
export const RARITIES = [
  { id: 0, key: 'common',    name: 'Commune',     maxRank: Infinity, weight: 6000, value: 1 },
  { id: 1, key: 'uncommon',  name: 'Peu commune', maxRank: 150000,   weight: 2500, value: 3 },
  { id: 2, key: 'rare',      name: 'Rare',        maxRank: 25000,    weight: 1050, value: 10 },
  { id: 3, key: 'epic',      name: 'Épique',      maxRank: 2500,     weight: 360,  value: 40 },
  { id: 4, key: 'legendary', name: 'Légendaire',  maxRank: 250,      weight: 80,   value: 200 },
  { id: 5, key: 'mythic',    name: 'Mythique',    maxRank: 25,       weight: 10,   value: 1500 },
];

export function rarityForRank(rank) {
  for (let r = RARITIES.length - 1; r >= 0; r--) if (rank <= RARITIES[r].maxRank) return r;
  return 0;
}

// Domaines d'infrastructure (CDN, DNS, pub, télémétrie) : ce ne sont pas des « sites » qu'on visite.
const INFRA = /(cdn|dns|akam|edge|static|^apis?\.|api[-.]|apis\b|analytic|metric|telemetr|tracking|adserv|adsys|adnxs|adsrvr|doubleclick|syndication|tagmanager|usercontent|azurefd|trafficmanager|cloudfront|fastly|lencr|digicert|^pki\.|^ntp\.|root-servers|gtld|registrar|parking|measurement|crashlytics|appsflyer|gvt\d|ytimg|fbcdn|ggpht|googlevideo|gstatic|amazonaws|windowsupdate|msftncsi|msftconnecttest|portal-detection|ocsp|mzstatic|nflx|rbxcdn|licdn|twimg|sfx\.ms|awswaf|demdex|omtrdc|scorecardresearch|criteo|taboola|pubmatic|rubiconproject|casalemedia|doubleverify|adsafeprotected|smartadserver|applovin|vungle|inmobi|amplitude|statsig|datadoghq|nr-data|sentry\.io|clarity\.ms|googleadservices|amazon-adsystem|2mdn|edgesuite|edgekey|akamaized|akamaihd|okcdn|trbcdn|yccdn|vkuser|userapi|apple-dns|aaplimg|whatsapp\.net|gwfb|tiktokv|tiktokcdn|byteoversea|bytefcdn|douyincdn|alicdn|aliyuncs|alibabadns|cdngslb|tbcache|heytap|allawnos|shalltry|samsungq|samsungcloud|playstation\.net|steamserver|xcal\.tv|ipify|ip-api|duckdns|dyndns|no-ip|myfritz|ddns|hicloudcam|ezviz|domaincontrol|worldnic|name-services|^nic\.|ripn\.net|lsrelay|wsdvs|live-video\.net|ttvnw|cookiedatabase|onelink\.me|publicnode|-msedge|msedge\.net|cloudapp|azurewebsites|windows\.net|office\.net|amazontrust|pv-cdn|endpoints\.|workers\.dev|pages\.dev|github\.io|blogspot\.|wixsite|myshopify|herokuapp|netlify\.app|vercel\.app|firebaseapp|web\.app|\.arpa$|\.local$|example\.(com|org|net)$|3gppnetwork|triplinkintl|trafficjunky|online-metrix|ibyteimg|shopifysvc|googletagservices|argotunnel|geoipcheck|youtube-nocookie|adtrafficquality|^nip\.io$|^sslip\.io$)/;

// Filtre contenu adulte (mots-clés, imparfait par nature).
const ADULT = /(porn|xxx|(^|[^s])sex|xvideo|xnxx|xhamster|hentai|nude|nsfw|onlyfans|chaturbate|stripchat|camsoda|bongacams|livejasmin|brazzers|redtube|youporn|spankbang|erotic|fetish|milf|escort|tube8|rule34|e621|nhentai|fapello|thothub|camgirl|jerkmate|boob|pussy|eporner|hqporner|beeg\.|tnaflix|txxx|hclips|myfreecams|highwebmedia|motherless|imagefap|literotica|playboy|xhcdn|faphouse|pornhat|sxyprn|hdzog|cam4|flirt4free|adultfriend|fansly|manyvids|clips4sale|iwara|kemono|coomer|gelbooru|danbooru|sankaku|pururin|hitomi\.la|9hentai|bokep|jav[a-z]*porn|ometv|chatroulette)/;

export function keepDomain(d) {
  if (!d || d.length > 80 || !d.includes('.')) return false;
  if (INFRA.test(d) || ADULT.test(d)) return false;
  return true;
}

// Famille d'une carte, dérivée de l'extension du domaine.
const FAMILIES = {
  com: 'Commerce', org: 'Organisation', net: 'Réseau', edu: 'Savoir', gov: 'État', mil: 'Défense',
  io: 'Tech', dev: 'Tech', ai: 'Tech', app: 'Tech', tech: 'Tech', so: 'Tech', sh: 'Tech', gg: 'Gaming',
  tv: 'Média', fm: 'Média', news: 'Média', me: 'Perso', co: 'Startup', xyz: 'Étrange', info: 'Info',
  shop: 'Commerce', store: 'Commerce', online: 'Réseau', site: 'Réseau', top: 'Étrange', club: 'Communauté',
};
export function familyOf(domain) {
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (FAMILIES[tld]) return FAMILIES[tld];
  if (/\.(gouv|gov|gob|govt)\.[a-z]{2}$/.test(domain)) return 'État';
  if (/\.(edu|ac)\.[a-z]{2}$/.test(domain)) return 'Savoir';
  if (tld.length === 2) return 'Pays ' + tld.toUpperCase();
  return 'Exotique';
}

// Lecteur ZIP minimal (une seule entrée deflate) pour éviter toute dépendance.
export function unzipFirst(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP invalide');
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10);
  const compSize = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  const nameLen = buf.readUInt16LE(local + 26);
  const extraLen = buf.readUInt16LE(local + 28);
  const start = local + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + compSize);
  return method === 0 ? data : inflateRawSync(data);
}

export async function loadTrancoCsv(file) {
  let buf;
  if (file) buf = readFileSync(file);
  else {
    const res = await fetch(TRANCO_URL, { redirect: 'follow' });
    if (!res.ok) throw new Error('Téléchargement Tranco impossible : HTTP ' + res.status);
    buf = Buffer.from(await res.arrayBuffer());
  }
  return (file && file.endsWith('.csv') ? buf : unzipFirst(buf)).toString('utf8');
}

// Remplit la table sites. Les id sont les rangs filtrés (1 = le plus visité).
export function importSites(db, csv) {
  const insert = db.prepare('INSERT INTO sites (id, domain, rarity, family) VALUES (?, ?, ?, ?)');
  const seen = new Set();
  let rank = 0;
  db.exec('BEGIN');
  try {
    for (const line of csv.split('\n')) {
      const comma = line.indexOf(',');
      if (comma < 0) continue;
      const domain = line.slice(comma + 1).trim().toLowerCase().replace(/^www\./, '');
      if (!keepDomain(domain) || seen.has(domain)) continue;
      seen.add(domain);
      rank++;
      insert.run(rank, domain, rarityForRank(rank), familyOf(domain));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return rank;
}
