// Outils d'exploitation : copie complète d'une base vers une autre, et déclencheur minute via pg_cron (Supabase).
import { migrate } from './db.js';

// Ordre compatible avec les clés étrangères.
const TABLES = ['meta', 'sites', 'site_blocks', 'users', 'sessions', 'cards', 'dex', 'friends', 'trades', 'trade_items', 'auctions', 'notifications', 'events', 'sales', 'value_history'];
const SERIAL = ['users', 'cards', 'trades', 'auctions', 'notifications', 'events', 'sales'];

export async function copyDatabase(src, dst, { chunk = 20_000 } = {}) {
  const t0 = Date.now();
  await migrate(dst);
  await dst.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  const counts = {};
  for (const t of TABLES) {
    const hasId = (await src.one("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'", [t])) != null;
    let n = 0, lastId = -1, offset = 0;
    const size = t === 'site_blocks' ? 100 : chunk; // les blocs pèsent ~15 Ko chacun
    for (;;) {
      const rows = hasId
        ? await src.all(`SELECT * FROM ${t} WHERE id > $1 ORDER BY id LIMIT $2`, [lastId, size])
        : await src.all(`SELECT * FROM ${t} ORDER BY 1, 2 LIMIT $1 OFFSET $2`, [size, offset]);
      if (!rows.length) break;
      await dst.query(`INSERT INTO ${t} SELECT * FROM json_populate_recordset(NULL::${t}, $1::json)`, [JSON.stringify(rows)]);
      n += rows.length;
      if (hasId) lastId = rows[rows.length - 1].id; else offset += rows.length;
      if (rows.length < size) break;
    }
    counts[t] = n;
  }
  for (const t of SERIAL) await dst.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), GREATEST(1, (SELECT COALESCE(MAX(id), 1) FROM ${t})))`);
  return { counts, seconds: Math.round((Date.now() - t0) / 1000) };
}

// Supabase sait appeler une URL toutes les minutes depuis la base (extensions pg_cron + pg_net), gratuitement.
export async function scheduleCron(db, url, secret, schedule = '* * * * *') {
  await db.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
  await db.query('CREATE EXTENSION IF NOT EXISTS pg_net');
  await db.query("SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'netdex-bots'");
  const headers = JSON.stringify({ Authorization: `Bearer ${secret}` }).replace(/'/g, "''");
  const target = url.replace(/'/g, "''");
  await db.query(`SELECT cron.schedule('netdex-bots', $1, $cmd$ SELECT net.http_get(url := '${target}', headers := '${headers}'::jsonb, timeout_milliseconds := 60000) $cmd$)`, [schedule]);
  return db.all("SELECT jobid, schedule, active FROM cron.job WHERE jobname = 'netdex-bots'");
}
