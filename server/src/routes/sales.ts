import { Router } from 'express';
import { z } from 'zod';
import { get, run } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../util/http.js';
import { addSaleItem } from '../services/sales.js';

export const salesRouter = Router();
salesRouter.use(requireAuth);

const saleSchema = z.object({
  bookingId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive(),
  qty: z.number().int().positive(),
});

salesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = saleSchema.parse(req.body);
    const result = await addSaleItem({ ...input, source: 'staff', userId: req.user!.id });
    res.status(201).json(result);
  }),
);

salesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const item = await get('SELECT id FROM sale_items WHERE id = ?', [id]);
    if (!item) throw notFound('ไม่พบรายการขาย');
    await run('DELETE FROM sale_items WHERE id = ?', [id]);
    res.json({ ok: true });
  }),
);
