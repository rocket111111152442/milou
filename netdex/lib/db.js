// Accès Postgres (Neon en production). Un pool par instance de fonction.
import pg from 'pg';
import { createHash } from 'node:crypto';

// BIGINT / COUNT / SUM reviennent en chaînes par défaut : on les veut en nombres (timestamps en ms, compteurs).
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1700, Number);

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  domain TEXT NOT NULL,
  rarity SMALLINT NOT NULL,
  family TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sites_domain ON sites (domain text_pattern_ops);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  bits INTEGER NOT NULL DEFAULT 0 CHECK (bits >= 0),
  pack_stock INTEGER NOT NULL DEFAULT 0,
  pack_anchor BIGINT NOT NULL,
  packs_opened INTEGER NOT NULL DEFAULT 0,
  daily_at BIGINT NOT NULL DEFAULT 0,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  dex_score INTEGER NOT NULL DEFAULT 0,
  dex_count INTEGER NOT NULL DEFAULT 0,
  avatar_site INTEGER,
  last_seen BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS users_name ON users (lower(username));
CREATE INDEX IF NOT EXISTS users_score ON users (dex_score DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL,
  holo SMALLINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'owned',
  obtained_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS cards_user ON cards (user_id, site_id);
CREATE INDEX IF NOT EXISTS cards_site ON cards (site_id);

CREATE TABLE IF NOT EXISTS dex (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL,
  found_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, site_id)
);

CREATE TABLE IF NOT EXISTS friends (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS friends_rev ON friends (friend_id, status);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_bits INTEGER NOT NULL DEFAULT 0,
  request_bits INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL,
  resolved_at BIGINT
);
CREATE INDEX IF NOT EXISTS trades_from ON trades (from_id, status);
CREATE INDEX IF NOT EXISTS trades_to ON trades (to_id, status);

CREATE TABLE IF NOT EXISTS trade_items (
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL,
  side TEXT NOT NULL,
  PRIMARY KEY (trade_id, card_id)
);

CREATE TABLE IF NOT EXISTS auctions (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  start_price INTEGER NOT NULL,
  buyout INTEGER,
  current_bid INTEGER,
  bidder_id INTEGER,
  bid_count INTEGER NOT NULL DEFAULT 0,
  ends_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS auctions_open ON auctions (status, ends_at);
CREATE INDEX IF NOT EXISTS auctions_seller ON auctions (seller_id, status);
CREATE INDEX IF NOT EXISTS auctions_bidder ON auctions (bidder_id, status);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  link TEXT,
  created_at BIGINT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, id DESC);

-- v2 : administrateurs et joueurs automatiques.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_next_at BIGINT;
CREATE INDEX IF NOT EXISTS users_bot_due ON users (bot_next_at) WHERE is_bot;
CREATE INDEX IF NOT EXISTS auctions_card ON auctions (card_id);

-- v3 : fil d'activité « En direct ».
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  at BIGINT NOT NULL,
  kind TEXT NOT NULL,
  user_id INTEGER,
  other_id INTEGER,
  site_id INTEGER,
  holo SMALLINT NOT NULL DEFAULT 0,
  amount INTEGER
);
CREATE INDEX IF NOT EXISTS users_seen ON users (last_seen DESC);

-- v4 : longue traîne des sites, historique des ventes et de la valeur des collections.
CREATE TABLE IF NOT EXISTS site_blocks (block INTEGER PRIMARY KEY, domains TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  at BIGINT NOT NULL,
  site_id INTEGER NOT NULL,
  rarity SMALLINT NOT NULL,
  holo SMALLINT NOT NULL DEFAULT 0,
  price INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_site ON sales (site_id, at);
CREATE INDEX IF NOT EXISTS sales_at ON sales (at);
CREATE TABLE IF NOT EXISTS price_index (
  at BIGINT NOT NULL,
  rarity SMALLINT NOT NULL,
  price INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (at, rarity)
);
CREATE TABLE IF NOT EXISTS value_history (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at BIGINT NOT NULL,
  value INTEGER NOT NULL,
  bits INTEGER NOT NULL,
  cards INTEGER NOT NULL,
  PRIMARY KEY (user_id, at)
);

-- v5 : progression (XP, succès, quêtes), mini-jeux, social, favoris, souhaits, codes promo.
ALTER TABLE users ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS fun JSONB NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS week_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS week_score INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS users_week ON users (week_id, week_score DESC);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS seller_id INTEGER;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS buyer_id INTEGER;
CREATE INDEX IF NOT EXISTS sales_seller ON sales (seller_id, at) WHERE seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_buyer ON sales (buyer_id, at) WHERE buyer_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, site_id)
);
CREATE TABLE IF NOT EXISTS wishlist (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS wishlist_site ON wishlist (site_id);
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  at BIGINT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS messages_pair ON messages (LEAST(from_id, to_id), GREATEST(from_id, to_id), id DESC);
CREATE INDEX IF NOT EXISTS messages_unread ON messages (to_id) WHERE NOT read;
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  bits INTEGER NOT NULL DEFAULT 0,
  packs INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 0,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at BIGINT,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS promo_uses (
  code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at BIGINT NOT NULL,
  PRIMARY KEY (code, user_id)
);

-- v6 : boosters scellés, boutiques d'échange, prêts, bourse.
CREATE TABLE IF NOT EXISTS sealed_packs (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boost REAL NOT NULL,
  quality TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'owned',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sealed_owner ON sealed_packs (owner_id, status);
ALTER TABLE users ADD COLUMN IF NOT EXISTS next_pack JSONB;
CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  fee_pct REAL NOT NULL DEFAULT 5,
  accepts TEXT[] NOT NULL DEFAULT ARRAY['standard','chanceux','brillant','prestige'],
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  div_pct REAL NOT NULL DEFAULT 0,
  div_day INTEGER NOT NULL DEFAULT 0,
  loan_rate REAL NOT NULL DEFAULT 10,
  loan_max INTEGER NOT NULL DEFAULT 1000,
  total_shares INTEGER NOT NULL DEFAULT 1000,
  last_price INTEGER,
  sales_count INTEGER NOT NULL DEFAULT 0,
  fees_total BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS shops_name ON shops (lower(name));
CREATE TABLE IF NOT EXISTS shop_listings (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  pack_id INTEGER NOT NULL REFERENCES sealed_packs(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price INTEGER NOT NULL CHECK (price > 0),
  status TEXT NOT NULL DEFAULT 'open',
  buyer_id INTEGER,
  created_at BIGINT NOT NULL,
  sold_at BIGINT
);
CREATE INDEX IF NOT EXISTS listings_shop ON shop_listings (shop_id, status);
CREATE TABLE IF NOT EXISTS shop_loans (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  borrower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  rate REAL NOT NULL,
  days INTEGER NOT NULL,
  due_amount INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL,
  accepted_at BIGINT,
  due_at BIGINT
);
CREATE INDEX IF NOT EXISTS loans_shop ON shop_loans (shop_id, status);
CREATE INDEX IF NOT EXISTS loans_borrower ON shop_loans (borrower_id, status);
CREATE INDEX IF NOT EXISTS loans_due ON shop_loans (status, due_at);
CREATE TABLE IF NOT EXISTS shares (
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked >= 0 AND locked <= qty),
  PRIMARY KEY (shop_id, user_id)
);
CREATE TABLE IF NOT EXISTS stock_orders (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  qty INTEGER NOT NULL CHECK (qty > 0),
  filled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_book ON stock_orders (shop_id, side, status, price, id);
CREATE INDEX IF NOT EXISTS orders_user ON stock_orders (user_id, status);
CREATE TABLE IF NOT EXISTS stock_trades (
  id BIGSERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  buyer_id INTEGER,
  seller_id INTEGER,
  at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS trades_shop ON stock_trades (shop_id, at);
CREATE TABLE IF NOT EXISTS shop_payouts (
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  amount BIGINT NOT NULL,
  per_share REAL NOT NULL,
  PRIMARY KEY (shop_id, day)
);
`;

// DB_SOURCE choisit la base parmi celles branchées sur Vercel : « supabase » (POSTGRES_URL) ou « neon » (stockage_DATABASE_URL).
export function databaseUrl(source = process.env.DB_SOURCE) {
  const e = process.env;
  if (e.NETDEX_DATABASE_URL) return e.NETDEX_DATABASE_URL;
  if (source === 'supabase') return e.POSTGRES_URL || null;
  if (source === 'neon') return e.stockage_DATABASE_URL || null;
  return e.stockage_DATABASE_URL || e.DATABASE_URL || e.POSTGRES_URL || null;
}

// Les paramètres sslmode/supa/pgbouncer des URL hébergées perturbent le pilote : le TLS est configuré à part.
function cleanUrl(url) {
  try {
    const u = new URL(url);
    for (const k of ['sslmode', 'supa', 'pgbouncer', 'channel_binding', 'sslrootcert']) u.searchParams.delete(k);
    return u.toString();
  } catch { return url; }
}

// Petite surcouche : db.one / db.all / db.run et db.tx(async (t) => ...) avec le même API dans la transaction.
function wrap(runner) {
  const query = (sql, params) => runner.query(sql, params);
  return {
    query,
    all: async (sql, params) => (await query(sql, params)).rows,
    one: async (sql, params) => (await query(sql, params)).rows[0],
    run: async (sql, params) => (await query(sql, params)).rowCount,
  };
}

export function createDb(url = databaseUrl(), { max } = {}) {
  if (!url) return null;
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new pg.Pool({
    connectionString: cleanUrl(url),
    max: max || Number(process.env.PG_POOL_MAX) || 4,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? false : { rejectUnauthorized: false },
  });
  const db = wrap(pool);
  db.pool = pool;
  db.tx = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await fn(wrap(client));
      await client.query('COMMIT');
      return r;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };
  db.close = () => pool.end();
  return db;
}

export const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || 'Ismaelleboulit').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// Empreinte du schéma : si la base est déjà à jour, on ne relance pas les ALTER TABLE (ils verrouillent les tables).
const SCHEMA_HASH = createHash('sha256').update(SCHEMA).digest('hex').slice(0, 16);

export async function migrate(db, { force = false } = {}) {
  const done = await db.one("SELECT value FROM meta WHERE key = 'schema'").catch(() => null);
  if (!force && done?.value === SCHEMA_HASH) return 'à jour';
  // Ne jamais faire la queue derrière une transaction longue : mieux vaut échouer vite que bloquer tout le jeu.
  await db.tx(async (q) => {
    await q.query("SET LOCAL lock_timeout = '3s'");
    await q.query(SCHEMA);
    await q.query("INSERT INTO meta (key, value) VALUES ('schema', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [SCHEMA_HASH]);
  });
  await db.query('UPDATE users SET is_admin = true WHERE lower(username) = ANY($1::text[]) AND NOT is_admin', [ADMIN_USERNAMES]);
  return 'migré';
}
