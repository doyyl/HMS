import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { asyncHandler } from '../util/http.js';
import { getAllSettings, setSetting, getReceiptTypes } from '../repositories/settings.js';
import { THAI_PROVINCES } from '../data/provinces.js';
import { audit } from '../util/audit.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

// Reference data + current settings (both roles).
settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ settings: await getAllSettings(), provinces: THAI_PROVINCES, receiptTypes: await getReceiptTypes() });
  }),
);

const updateSchema = z.object({ settings: z.record(z.string(), z.string()) });

// Manager-only: update pricing/time constants.
settingsRouter.put(
  '/',
  requireManager,
  asyncHandler(async (req, res) => {
    const { settings } = updateSchema.parse(req.body);
    for (const [key, value] of Object.entries(settings)) await setSetting(key, value);
    await audit(req.user!.id, 'settings_update', 'settings', undefined, Object.keys(settings).join(','));
    res.json({ settings: await getAllSettings() });
  }),
);
