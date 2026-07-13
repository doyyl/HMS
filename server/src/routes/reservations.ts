import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../util/http.js';
import { availableRooms } from '../services/availability.js';
import {
  createReservation,
  cancelReservation,
  markNoShow,
  checkInReservation,
  listReservations,
  arrivalsToday,
} from '../services/reservation.js';

export const reservationsRouter = Router();
reservationsRouter.use(requireAuth);

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

// Rooms available for a date range.
reservationsRouter.get(
  '/availability',
  asyncHandler(async (req, res) => {
    const q = z.object({ checkIn: DATE, checkOut: DATE }).parse(req.query);
    res.json({ rooms: await availableRooms(q.checkIn, q.checkOut) });
  }),
);

// Active reservations, optionally filtered by status; ?arrivals=today for the arrivals panel.
reservationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.query.arrivals === 'today') return res.json({ reservations: await arrivalsToday() });
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json({ reservations: await listReservations(status) });
  }),
);

const createSchema = z.object({
  roomId: z.number().int().positive(),
  checkInDate: DATE,
  checkOutDate: DATE,
  guestName: z.string().trim().min(1).max(120),
  guestPhone: z.string().trim().min(1).max(30),
  guestEmail: z.string().trim().email().max(120).optional().nullable(),
});

// Staff/phone reservation — created confirmed (guest pays on arrival).
reservationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const reservation = await createReservation({ ...input, source: 'phone', status: 'confirmed', userId: req.user!.id });
    res.status(201).json({ reservation });
  }),
);

reservationsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    await cancelReservation(Number(req.params.id), req.user!.id);
    res.json({ ok: true });
  }),
);

reservationsRouter.post(
  '/:id/no-show',
  asyncHandler(async (req, res) => {
    await markNoShow(Number(req.params.id), req.user!.id);
    res.json({ ok: true });
  }),
);

reservationsRouter.post(
  '/:id/check-in',
  asyncHandler(async (req, res) => {
    res.json(await checkInReservation(Number(req.params.id), req.user!.id));
  }),
);
