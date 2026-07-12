import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db/index.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../util/http.js';

export const productsRouter = Router();
productsRouter.use(requireAuth);

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === '1';
    const sql = includeInactive
      ? 'SELECT * FROM products ORDER BY category, name'
      : 'SELECT * FROM products WHERE active = 1 ORDER BY category, name';
    res.json({ products: await all(sql) });
  }),
);

const productSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().int().min(0),
  category: z.string().trim().min(1).default('ทั่วไป'),
  active: z.boolean().optional(),
});

productsRouter.post(
  '/',
  requireManager,
  asyncHandler(async (req, res) => {
    const p = productSchema.parse(req.body);
    const r = await run('INSERT INTO products(name, price, category, active) VALUES (?, ?, ?, ?) RETURNING id', [
      p.name,
      p.price,
      p.category,
      p.active === false ? 0 : 1,
    ]);
    res.status(201).json({ product: await get('SELECT * FROM products WHERE id = ?', [Number(r.rows[0]!.id)]) });
  }),
);

productsRouter.put(
  '/:id',
  requireManager,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const p = productSchema.parse(req.body);
    const exists = await get('SELECT id FROM products WHERE id = ?', [id]);
    if (!exists) throw notFound('ไม่พบสินค้า');
    await run('UPDATE products SET name = ?, price = ?, category = ?, active = ? WHERE id = ?', [
      p.name,
      p.price,
      p.category,
      p.active === false ? 0 : 1,
      id,
    ]);
    res.json({ product: await get('SELECT * FROM products WHERE id = ?', [id]) });
  }),
);

productsRouter.delete(
  '/:id',
  requireManager,
  asyncHandler(async (req, res) => {
    await run('UPDATE products SET active = 0 WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  }),
);
