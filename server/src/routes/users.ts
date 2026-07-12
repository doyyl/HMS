import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, get, run } from '../db/index.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../util/http.js';
import { audit } from '../util/audit.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireManager); // user management is manager-only

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({
      users: await all('SELECT id, username, role, display_name, active, created_at FROM users ORDER BY id'),
    });
  }),
);

const createSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(6),
  role: z.enum(['manager', 'staff']),
  displayName: z.string().trim().min(1),
});

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const u = createSchema.parse(req.body);
    const exists = await get('SELECT id FROM users WHERE username = ?', [u.username]);
    if (exists) throw badRequest('ชื่อผู้ใช้นี้มีอยู่แล้ว');
    const r = await run(
      'INSERT INTO users(username, password_hash, role, display_name) VALUES (?, ?, ?, ?) RETURNING id',
      [u.username, bcrypt.hashSync(u.password, 10), u.role, u.displayName],
    );
    await audit(req.user!.id, 'user_create', 'user', Number(r.rows[0]!.id), u.username);
    res.status(201).json({ id: Number(r.rows[0]!.id) });
  }),
);

const updateSchema = z.object({
  password: z.string().min(6).optional(),
  role: z.enum(['manager', 'staff']).optional(),
  displayName: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
});

usersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const u = updateSchema.parse(req.body);
    const row = await get('SELECT id FROM users WHERE id = ?', [id]);
    if (!row) throw notFound('ไม่พบผู้ใช้');
    if (u.password) await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(u.password, 10), id]);
    if (u.role) await run('UPDATE users SET role = ? WHERE id = ?', [u.role, id]);
    if (u.displayName) await run('UPDATE users SET display_name = ? WHERE id = ?', [u.displayName, id]);
    if (u.active !== undefined) await run('UPDATE users SET active = ? WHERE id = ?', [u.active ? 1 : 0, id]);
    await audit(req.user!.id, 'user_update', 'user', id);
    res.json({ ok: true });
  }),
);
