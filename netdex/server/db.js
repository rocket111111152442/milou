import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  rarity INTEGER NOT NULL,
  family TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sites_rarity ON sites(rarity, id);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  bits INTEGER NOT NULL DEFAULT 0,
  pack_stock INTEGER NOT NULL DEFAULT 0,
  pack_anchor INTEGER NOT NULL,
  packs_opened INTEGER NOT NULL DEFAULT 0,
  daily_at INTEGER NOT NULL DEFAULT 0,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  dex_score INTEGER NOT NULL DEFAULT 0,
  dex_count INTEGER NOT NULL DEFAULT 0,
  avatar_site INTEGER,
  last_seen INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS users_score ON users(dex_score DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  holo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'owned',
  obtained_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cards_user ON cards(user_id, site_id);
CREATE INDEX IF NOT EXISTS cards_site ON cards(site_id);

-- Pokédex : sites déjà découverts au moins une fois.
CREATE TABLE IF NOT EXISTS dex (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL,
  found_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, site_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS friends (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS friends_rev ON friends(friend_id, status);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_bits INTEGER NOT NULL DEFAULT 0,
  request_bits INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS trades_from ON trades(from_id, status);
CREATE INDEX IF NOT EXISTS trades_to ON trades(to_id, status);

CREATE TABLE IF NOT EXISTS trade_items (
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL,
  side TEXT NOT NULL,
  PRIMARY KEY (trade_id, card_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS auctions (
  id INTEGER PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  start_price INTEGER NOT NULL,
  buyout INTEGER,
  current_bid INTEGER,
  bidder_id INTEGER,
  bid_count INTEGER NOT NULL DEFAULT 0,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auctions_open ON auctions(status, ends_at);
CREATE INDEX IF NOT EXISTS auctions_seller ON auctions(seller_id, status);
CREATE INDEX IF NOT EXISTS auctions_bidder ON auctions(bidder_id, status);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  link TEXT,
  created_at INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, id DESC);
`;

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA cache_size = -32000;');
  db.exec(SCHEMA);
  return db;
}

// Cache de requêtes préparées : db.q(sql).get(...)
export function withStatementCache(db) {
  const cache = new Map();
  db.q = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = db.prepare(sql); cache.set(sql, s); }
    return s;
  };
  db.tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const r = fn();
      db.exec('COMMIT');
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
  return db;
}
