import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { asyncHandler } from '../util/http.js';
import { getCurrentShift, getShiftSummary, openShift, setFloat, closeShift } from '../services/shift.js';

export const shiftsRouter = Router();
shiftsRouter.use(requireAuth);

shiftsRouter.get(
  '/current',
  asyncHandler(async (_req, res) => {
    const shift = await getCurrentShift();
    res.json({ shift, summary: shift ? await getShiftSummary(shift.id) : null });
  }),
);

const openSchema = z.object({ opening_float: z.coerce.number().int().min(0).default(0) });

shiftsRouter.post(
  '/open',
  asyncHandler(async (req, res) => {
    const { opening_float } = openSchema.parse(req.body);
    const shift = await openShift(req.user!.id, req.user!.role === 'manager', opening_float);
    res.status(201).json({ shift });
  }),
);

const floatSchema = z.object({ opening_float: z.coerce.number().int().min(0) });

// Manager-only: adjust the opening change float (เงินตั้งต้นที่ให้ไปทอนลูกค้า).
shiftsRouter.patch(
  '/:id/float',
  requireManager,
  asyncHandler(async (req, res) => {
    const { opening_float } = floatSchema.parse(req.body);
    res.json({ shift: await setFloat(Number(req.params.id), opening_float, req.user!.id) });
  }),
);

const closeSchema = z.object({ closing_count: z.coerce.number().int().min(0) });

shiftsRouter.post(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const { closing_count } = closeSchema.parse(req.body);
    res.json({ shift: await closeShift(Number(req.params.id), closing_count, req.user!.id) });
  }),
);
