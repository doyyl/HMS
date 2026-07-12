import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../util/http.js';
import { addSaleItem } from '../services/sales.js';
import { audit } from '../util/audit.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

// Staff order queue (defaults to pending).
ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = (req.query.status as string) ?? 'pending';
    const orders = await all<{ id: number; status: string; created_at: Date; booking_id: number | null; room_label: string }>(
      `SELECT o.id, o.status, o.created_at, o.booking_id, r.label AS room_label
       FROM customer_orders o JOIN rooms r ON r.id = o.room_id
       WHERE o.status = ? ORDER BY o.created_at`,
      [status],
    );
    const withItems = await Promise.all(
      orders.map(async (o) => ({
        ...o,
        items: await all('SELECT product_id, name, qty, unit_price FROM customer_order_items WHERE order_id = ?', [o.id]),
      })),
    );
    res.json({ orders: withItems });
  }),
);

ordersRouter.post(
  '/:id/accept',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const order = await get<{ id: number; status: string; booking_id: number | null }>(
      'SELECT id, status, booking_id FROM customer_orders WHERE id = ?',
      [id],
    );
    if (!order) throw notFound('ไม่พบคำสั่งซื้อ');
    if (order.status !== 'pending') throw badRequest('คำสั่งซื้อถูกจัดการแล้ว');
    if (order.booking_id == null) throw badRequest('ไม่มีรายการเข้าพักที่เชื่อมโยง');

    const items = await all<{ product_id: number; qty: number }>(
      'SELECT product_id, qty FROM customer_order_items WHERE order_id = ?',
      [id],
    );
    for (const it of items) {
      await addSaleItem({ bookingId: order.booking_id, productId: it.product_id, qty: it.qty, source: 'customer', userId: req.user!.id });
    }
    await run("UPDATE customer_orders SET status = 'done', handled_by = ?, handled_at = ? WHERE id = ?", [
      req.user!.id,
      new Date(),
      id,
    ]);
    await audit(req.user!.id, 'order_accept', 'customer_order', id);
    res.json({ ok: true });
  }),
);

ordersRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await run(
      "UPDATE customer_orders SET status = 'rejected', handled_by = ?, handled_at = ? WHERE id = ? AND status = 'pending'",
      [req.user!.id, new Date(), id],
    );
    await audit(req.user!.id, 'order_reject', 'customer_order', id);
    res.json({ ok: true });
  }),
);
