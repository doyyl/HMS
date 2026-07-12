import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../util/http.js';
import {
  checkIn,
  extendShortStay,
  convertToOvernight,
  checkOut,
  getFolio,
  voidBooking,
} from '../services/booking.js';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth);

const checkInSchema = z.object({
  roomId: z.number().int().positive(),
  type: z.enum(['short', 'overnight']),
  licensePlate: z.string().trim().max(20).optional().nullable(),
  province: z.string().trim().max(40).optional().nullable(),
  payEarlyExtend: z.boolean().optional(),
});

bookingsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = checkInSchema.parse(req.body);
    const booking = await checkIn({ ...input, userId: req.user!.id });
    res.status(201).json({ booking });
  }),
);

bookingsRouter.get(
  '/:id/folio',
  asyncHandler(async (req, res) => {
    res.json(await getFolio(Number(req.params.id)));
  }),
);

bookingsRouter.post(
  '/:id/extend',
  asyncHandler(async (req, res) => {
    res.json(await extendShortStay(Number(req.params.id), req.user!.id));
  }),
);

bookingsRouter.post(
  '/:id/convert-overnight',
  asyncHandler(async (req, res) => {
    res.json({ booking: await convertToOvernight(Number(req.params.id), req.user!.id) });
  }),
);

bookingsRouter.post(
  '/:id/checkout',
  asyncHandler(async (req, res) => {
    res.json(await checkOut(Number(req.params.id), req.user!.id));
  }),
);

bookingsRouter.post(
  '/:id/void',
  asyncHandler(async (req, res) => {
    await voidBooking(Number(req.params.id), req.user!.id);
    res.json({ ok: true });
  }),
);
