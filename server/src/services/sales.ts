import { get, run } from '../db/index.js';
import { badRequest, notFound } from '../util/http.js';

export interface AddSaleInput {
  bookingId?: number | null;
  productId: number;
  qty: number;
  source?: 'staff' | 'customer';
  userId?: number | null;
}

/** Add a supplementary sale line, snapshotting product name/price. */
export async function addSaleItem(input: AddSaleInput): Promise<{ id: number; line_total: number }> {
  const qty = Math.trunc(input.qty);
  if (qty <= 0) throw badRequest('จำนวนต้องมากกว่า 0');
  const product = await get<{ id: number; name: string; price: number }>(
    'SELECT id, name, price FROM products WHERE id = ?',
    [input.productId],
  );
  if (!product) throw notFound('ไม่พบสินค้า');

  if (input.bookingId != null) {
    const booking = await get<{ id: number; status: string }>('SELECT id, status FROM bookings WHERE id = ?', [
      input.bookingId,
    ]);
    if (!booking) throw notFound('ไม่พบรายการเข้าพัก');
    if (booking.status !== 'active') throw badRequest('รายการเข้าพักปิดแล้ว');
  }

  const lineTotal = product.price * qty;
  const res = await run(
    `INSERT INTO sale_items(booking_id, product_id, name, qty, unit_price, line_total, source, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [input.bookingId ?? null, product.id, product.name, qty, product.price, lineTotal, input.source ?? 'staff', input.userId ?? null],
  );
  return { id: Number(res.rows[0]!.id), line_total: lineTotal };
}
