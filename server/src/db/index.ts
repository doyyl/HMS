import fs from 'node:fs';
import pg from 'pg';
import { config } from '../config.js';

// Minimal driver surface both pg.Pool and PGlite can satisfy.
interface Driver {
  query(sql: string, params: unknown[]): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }>;
  exec(sql: string): Promise<void>;
  end(): Promise<void>;
}

let driver: Driver | null = null;

async function makeDriver(): Promise<Driver> {
  // Tests run against an in-process Postgres (pglite) — no external server needed.
  if (config.nodeEnv === 'test') {
    // Non-literal specifier + local typing so production bundlers (Vercel/esbuild)
    // don't try to bundle or type-resolve this dev-only dependency.
    const pglitePkg = '@electric-sql/pglite';
    interface PGliteLike {
      query(sql: string, params: unknown[]): Promise<{ rows: unknown[]; affectedRows?: number }>;
      exec(sql: string): Promise<unknown>;
      close(): Promise<void>;
    }
    const mod = (await import(pglitePkg)) as { PGlite: new (opts?: unknown) => PGliteLike };
    // Return DATE (OID 1082) as a raw 'YYYY-MM-DD' string, not a Date, to avoid
    // timezone-shift bugs when the value crosses the JSON boundary.
    const db = new mod.PGlite({ parsers: { 1082: (v: string) => v } });
    return {
      async query(sql, params) {
        const res = await db.query(sql, params as unknown[]);
        return { rows: res.rows as Array<Record<string, unknown>>, rowCount: res.affectedRows ?? res.rows.length };
      },
      exec: (sql) => db.exec(sql).then(() => undefined),
      end: () => db.close(),
    };
  }

  // Return DATE (OID 1082) as a raw 'YYYY-MM-DD' string (node-pg otherwise
  // parses it to a local-midnight Date, which shifts a day under Asia/Bangkok).
  pg.types.setTypeParser(1082, (v) => v);

  // Supabase's pooler and most managed PGs require TLS. Local dev PG does not;
  // enable SSL only for non-localhost hosts.
  const isLocal = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 10,
  });
  return {
    async query(sql, params) {
      const res = await pool.query(sql, params);
      return { rows: res.rows as Array<Record<string, unknown>>, rowCount: res.rowCount ?? 0 };
    },
    exec: (sql) => pool.query(sql).then(() => undefined),
    end: () => pool.end(),
  };
}

async function getDriver(): Promise<Driver> {
  if (!driver) driver = await makeDriver();
  return driver;
}

/** Convert SQLite-style "?" placeholders to Postgres "$1, $2, …". */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${(i += 1)}`);
}

export async function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const d = await getDriver();
  const res = await d.query(toPg(sql), params);
  return res.rows as T[];
}

export async function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const d = await getDriver();
  const res = await d.query(toPg(sql), params);
  return res.rows[0] as T | undefined;
}

/**
 * Execute a write. Append `RETURNING id` in the SQL to get the new id back as
 * `rows[0].id` (Postgres has no lastInsertRowid).
 */
export async function run(
  sql: string,
  params: unknown[] = [],
): Promise<{ rowCount: number; rows: Array<Record<string, unknown>> }> {
  const d = await getDriver();
  const res = await d.query(toPg(sql), params);
  return { rowCount: res.rowCount, rows: res.rows };
}

/** Apply the Postgres schema (idempotent — IF NOT EXISTS throughout). */
export async function applySchema(): Promise<void> {
  const d = await getDriver();
  const schema = fs.readFileSync(config.schemaPath, 'utf-8');
  await d.exec(schema);
  // btree_gist EXCLUDE constraint is real-Postgres only (pglite lacks it).
  if (config.nodeEnv !== 'test' && fs.existsSync(config.schemaPgPath)) {
    await d.exec(fs.readFileSync(config.schemaPgPath, 'utf-8'));
  }
}

/** Liveness check: resolves if the database answers a trivial query. */
export async function ping(): Promise<void> {
  const d = await getDriver();
  await d.query('SELECT 1', []);
}

export async function closePool(): Promise<void> {
  if (driver) await driver.end();
  driver = null;
}
