import { all } from '../db/index.js';
import { run } from '../db/index.js';
import { pricingFromSettings, type PricingConfig } from '../domain/pricing/index.js';

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function getPricing(): Promise<PricingConfig> {
  return pricingFromSettings(await getAllSettings());
}

export async function setSetting(key: string, value: string): Promise<void> {
  await run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    value,
  ]);
}

export async function getReceiptTypes(): Promise<string[]> {
  const settings = await getAllSettings();
  const v = settings.RECEIPT_TYPES ?? 'none,receipt,invoice';
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}
