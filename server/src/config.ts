import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'hms-dev-secret-change-me',
  jwtExpiresIn: '12h',

  // Postgres connection string (Supabase pooler in prod, local PG in dev).
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/hms',

  // Supabase Storage for QR slip images. When SUPABASE_URL is unset the app
  // falls back to local-disk storage (dev only).
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  supabaseBucket: process.env.SUPABASE_BUCKET ?? 'slips',

  uploadsDir: process.env.UPLOADS_DIR ?? path.join(__dirname, '..', 'uploads'),
  schemaPath: path.join(__dirname, 'db', 'schema.sql'),
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
};
