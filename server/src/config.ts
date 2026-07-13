import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const DEFAULT_JWT_SECRET = 'hms-dev-secret-change-me';
const jwtSecret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;

// Fail fast: never boot production on the shared dev secret.
if (isProduction && (jwtSecret === DEFAULT_JWT_SECRET || jwtSecret.length < 16)) {
  throw new Error(
    'JWT_SECRET must be set to a strong, non-default value (>=16 chars) in production.',
  );
}

// Comma-separated allowlist of browser origins. Empty in dev = reflect any origin.
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  jwtExpiresIn: '12h',
  corsOrigins,

  // Public base URL of this deployment (used for payment return URLs later).
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,

  // Postgres connection string (Supabase pooler in prod, local PG in dev).
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/hms',

  // Supabase Storage for QR slip images. When SUPABASE_URL is unset the app
  // falls back to local-disk storage (dev only).
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  supabaseBucket: process.env.SUPABASE_BUCKET ?? 'slips',

  uploadsDir: process.env.UPLOADS_DIR ?? path.join(__dirname, '..', 'uploads'),
  schemaPath: path.join(__dirname, 'db', 'schema.sql'),
  // Real-Postgres-only DDL (btree_gist EXCLUDE). Skipped under the pglite test driver.
  schemaPgPath: path.join(__dirname, 'db', 'schema.pg.sql'),
} as const;

// Default pricing/time constants. Seeded into the settings table and editable
// by a manager at runtime.
export const DEFAULT_SETTINGS: Record<string, string> = {
  SHORT_BASE_PRICE: '200',
  SHORT_BASE_HOURS: '2',
  SHORT_EXT_PRICE: '50',
  SHORT_EXT_HOURS: '1',
  CONVERT_TOTAL_THRESHOLD: '500',
  CONVERT_EXT_HOURS_THRESHOLD: '5',
  OVERNIGHT_PRICE: '500',
  OVERNIGHT_CHECKIN_HOUR: '11',
  OVERNIGHT_CHECKOUT_HOUR: '11',
  EARLY_CHECKOUT_HOUR: '18',
  EARLY_CHECKIN_FEE: '50',
  RECEIPT_TYPES: 'none,receipt,invoice',
  HOTEL_NAME: 'โรงแรม',
  HOTEL_ADDRESS: '',
  // Minutes an unpaid online reservation holds a room before auto-expiring.
  RESERVATION_HOLD_MINUTES: '15',
  // Hour (Bangkok) after the arrival day at which a confirmed no-show is flagged.
  NO_SHOW_HOUR: '14',
};
