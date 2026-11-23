import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { config } from "../config.js";

export type DB = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let database: DB | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config().DATABASE_URL, max: 10 });
  }
  return pool;
}

export function db(): DB {
  if (!database) database = drizzle(getPool(), { schema });
  return database;
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = null;
  database = null;
}

export { schema };
