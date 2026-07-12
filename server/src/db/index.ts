import fs from 'node:fs';
import pg from 'pg';
import { config } from '../config.js';

// Supabase's pooler and most managed PGs require TLS. Local dev PG does not;
// enable SSL only for non-localhost hosts.
const isLocal = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
  max: 10,
});

/** Convert SQLite-style "?" placeholders to Postgres "$1, $2, …". */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${(i += 1)}`);
}

export async function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(toPg(sql), params);
  return res.rows as T[];
}

export async function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const res = await pool.query(toPg(sql), params);
  return res.rows[0] as T | undefined;
}

/**
 * Execute a write. Append `RETURNING id` in the SQL to get the new id back as
 * `rows[0].id` (Postgres has no lastInsertRowid).
 */
export async function run(sql: string, params: unknown[] = []): Promise<{ rowCount: number; rows: Array<Record<string, unknown>> }> {
  const res = await pool.query(toPg(sql), params);
  return { rowCount: res.rowCount ?? 0, rows: res.rows };
}

/** Apply the Postgres schema (idempotent — IF NOT EXISTS throughout). */
export async function applySchema(): Promise<void> {
  const schema = fs.readFileSync(config.schemaPath, 'utf-8');
  await pool.query(schema);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
