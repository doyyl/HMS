import { Router } from 'express';
import fs from 'node:fs';
import { z } from 'zod';
import { run } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadSlip } from '../middleware/upload.js';
import { asyncHandler, badRequest } from '../util/http.js';
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
