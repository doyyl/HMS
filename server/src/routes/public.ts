import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db/index.js';
import { asyncHandler, badRequest, notFound } from '../util/http.js';

// Public, unauthenticated router for the in-room customer ordering page.
// Access is gated by the room's rotating order_token; orders are accepted only
// while the room has an active booking.
export const publicRouter = Router();

function roomByToken(token: string) {
  return get<{ id: number; label: string; status: string; current_booking_id: number | null }>(
    'SELECT id, label, status, current_booking_id FROM rooms WHERE order_token = ?',
    [token],
  );
}

publicRouter.get(
  '/room/:token',
  asyncHandler(async (req, res) => {
    const room = await roomByToken(String(req.params.token));
    if (!room) throw notFound('ไม่พบห้องพัก');
    const products = await all('SELECT id, name, price, category FROM products WHERE active = 1 ORDER BY category, name');
    res.json({
      room: { label: room.label },
      canOrder: room.status === 'occupied' && room.current_booking_id != null,
      products,
    });
  }),
);

const orderSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), qty: z.number().int().positive() })).min(1),
});

publicRouter.post(
  '/room/:token/order',
  asyncHandler(async (req, res) => {
    const room = await roomByToken(String(req.params.token));
    if (!room) throw notFound('ไม่พบห้องพัก');
    if (room.status !== 'occupied' || room.current_booking_id == null) throw badRequest('ยังไม่สามารถสั่งได้ในขณะนี้');
    const { items } = orderSchema.parse(req.body);

    const orderRes = await run('INSERT INTO customer_orders(room_id, booking_id) VALUES (?, ?) RETURNING id', [
      room.id,
      room.current_booking_id,
    ]);
    const orderId = Number(orderRes.rows[0]!.id);

    for (const it of items) {
      const p = await get<{ id: number; name: string; price: number }>(
        'SELECT id, name, price FROM products WHERE id = ? AND active = 1',
        [it.productId],
      );
      if (!p) throw badRequest('มีสินค้าที่ไม่พร้อมจำหน่าย');
      await run('INSERT INTO customer_order_items(order_id, product_id, name, qty, unit_price) VALUES (?, ?, ?, ?, ?)', [
        orderId,
        p.id,
        p.name,
        Math.trunc(it.qty),
        p.price,
      ]);
    }
    res.status(201).json({ ok: true, orderId });
  }),
);
