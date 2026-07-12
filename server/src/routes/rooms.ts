import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../util/http.js';
import { audit } from '../util/audit.js';

export const roomsRouter = Router();
roomsRouter.use(requireAuth);

// Room board: every room with its current booking (if any).
roomsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await all(
      `SELECT r.id, r.building, r.number, r.label, r.status, r.cleaning_status,
              r.current_booking_id,
              b.type, b.check_in_at, b.expected_checkout_at, b.room_total,
              b.license_plate, b.province, b.converted_overnight
       FROM rooms r
       LEFT JOIN bookings b ON b.id = r.current_booking_id
       ORDER BY r.building, r.number`,
    );
    res.json({ rooms: rows });
  }),
);

const cleaningSchema = z.object({ cleaning_status: z.enum(['clean', 'dirty', 'cleaning']) });

roomsRouter.patch(
  '/:id/cleaning',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { cleaning_status } = cleaningSchema.parse(req.body);
    const room = await get<{ id: number; status: string }>('SELECT id, status FROM rooms WHERE id = ?', [id]);
    if (!room) throw notFound('ไม่พบห้องพัก');
    if (room.status === 'occupied' && cleaning_status !== 'clean') throw badRequest('ห้องมีผู้เข้าพักอยู่');
    await run('UPDATE rooms SET cleaning_status = ? WHERE id = ?', [cleaning_status, id]);
    await audit(req.user!.id, 'cleaning', 'room', id, cleaning_status);
    res.json({ ok: true });
  }),
);
