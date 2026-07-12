import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

// Two backends for QR slip images:
//  - Supabase Storage (private bucket) when SUPABASE_URL + SUPABASE_SERVICE_KEY are set
//  - Local disk fallback (dev only) otherwise
const useSupabase = Boolean(config.supabaseUrl && config.supabaseServiceKey);
const supabase: SupabaseClient | null = useSupabase
  ? createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false } })
  : null;

export const storageBackend = useSupabase ? 'supabase' : 'local';

/** Store a slip image; returns an opaque storage key. */
export async function putSlip(buffer: Buffer, originalName: string, contentType: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const key = `slip-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  if (supabase) {
    const { error } = await supabase.storage.from(config.supabaseBucket).upload(key, buffer, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    return key;
  }
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(config.uploadsDir, key), buffer);
  return key;
}

/** A short-lived signed URL for a slip (Supabase), or null for local disk. */
export async function slipUrl(key: string): Promise<string | null> {
  if (supabase) {
    const { data, error } = await supabase.storage.from(config.supabaseBucket).createSignedUrl(path.basename(key), 3600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }
  return null;
}

export function localSlipPath(key: string): string {
  return path.join(config.uploadsDir, path.basename(key));
}
