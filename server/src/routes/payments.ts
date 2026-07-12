import { Router } from 'express';
import fs from 'node:fs';
import { z } from 'zod';
import { all, get, run } from '../db/index.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { uploadSlip } from '../middleware/upload.js';
import { asyncHandler, badRequest, notFound } from '../util/http.js';
import { getCurrentShift } from '../services/shift.js';
import { getReceiptTypes } from '../repositories/settings.js';
import { putSlip, slipUrl, localSlipPath } from '../services/storage.js';
import { audit } from '../util/audit.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const paymentSchema = z.object({
  bookingId: z.coerce.number().int().positive().optional(),
  amount: z.coerce.number().int().positive(),
  method: z.enum(['cash', 'qr']),
  receiptType: z.string().min(1),
});

// Record a payment. For QR payments a slip image is required (multipart field "slip").
paymentsRouter.post(
  '/',
  (req, res, next) => uploadSlip(req, res, (err) => (err ? next(badRequest(err.message)) : next())),
  asyncHandler(async (req, res) => {
    const input = paymentSchema.parse(req.body);
    if (!(await getReceiptTypes()).includes(input.receiptType)) throw badRequest('ประเภทใบเสร็จไม่ถูกต้อง');

    if (input.method === 'qr' && !req.file) throw badRequest('การชำระแบบ QR ต้องแนบรูปสลิป');
    const slipKey = req.file ? await putSlip(req.file.buffer, req.file.originalname, req.file.mimetype) : null;

    const shift = await getCurrentShift();
    const r = await run(
      `INSERT INTO payments(booking_id, shift_id, amount, method, receipt_type, slip_image_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [input.bookingId ?? null, shift?.id ?? null, input.amount, input.method, input.receiptType, slipKey, req.user!.id],
    );
    await audit(req.user!.id, 'payment', 'payment', Number(r.rows[0]!.id), `${input.method} ${input.amount}`);
    res.status(201).json({ id: Number(r.rows[0]!.id), slip: slipKey });
  }),
);

// Payments recorded in the current open shift (for reconciliation / voiding).
paymentsRouter.get(
  '/current-shift',
  asyncHandler(async (_req, res) => {
    const shift = await getCurrentShift();
    if (!shift) return res.json({ payments: [] });
    const payments = await all<{
      id: number;
      amount: number;
      method: string;
      status: string;
      booking_id: number | null;
      room_label: string | null;
      created_at: Date;
    }>(
      `SELECT p.id, p.amount, p.method, p.status, p.booking_id, r.label AS room_label, p.created_at
       FROM payments p
       LEFT JOIN bookings b ON b.id = p.booking_id
       LEFT JOIN rooms r ON r.id = b.room_id
       WHERE p.shift_id = ? ORDER BY p.id DESC`,
      [shift.id],
    );
    res.json({ payments });
  }),
);

// Void a payment (manager-only). Voided payments drop out of shift
// reconciliation and revenue reports but remain on record with an audit trail.
const voidSchema = z.object({ reason: z.string().trim().max(200).optional() });
paymentsRouter.post(
  '/:id/void',
  requireManager,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const reason = voidSchema.parse(req.body ?? {}).reason ?? null;
    const p = await get<{ id: number; status: string; amount: number; method: string }>(
      'SELECT id, status, amount, method FROM payments WHERE id = ?',
      [id],
    );
    if (!p) throw notFound('ไม่พบรายการชำระเงิน');
    if (p.status === 'voided') throw badRequest('รายการนี้ถูกยกเลิกแล้ว');
    await run("UPDATE payments SET status = 'voided', voided_by = ?, voided_at = ?, void_reason = ? WHERE id = ?", [
      req.user!.id,
      new Date(),
      reason,
      id,
    ]);
    await audit(req.user!.id, 'payment_void', 'payment', id, `${p.method} ${p.amount}${reason ? ' · ' + reason : ''}`);
    res.json({ ok: true });
  }),
);

// Serve a slip: redirect to a signed URL (Supabase) or stream the local file.
paymentsRouter.get(
  '/slip/:name',
  asyncHandler(async (req, res) => {
    const key = String(req.params.name);
    const url = await slipUrl(key);
    if (url) return res.redirect(url);
    const full = localSlipPath(key);
    if (!fs.existsSync(full)) throw badRequest('ไม่พบไฟล์สลิป');
    res.sendFile(full);
  }),
);
