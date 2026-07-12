import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { get, run } from '../db/index.js';
import { signToken, requireAuth, type AuthUser } from '../middleware/auth.js';
import { asyncHandler, badRequest, unauthorized } from '../util/http.js';
import { audit } from '../util/audit.js';

export const authRouter = Router();

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const row = await get<{
      id: number;
      username: string;
      password_hash: string;
      role: 'manager' | 'staff';
      display_name: string;
      active: number;
    }>('SELECT id, username, password_hash, role, display_name, active FROM users WHERE username = ?', [username]);
    if (!row || row.active === 0 || !bcrypt.compareSync(password, row.password_hash)) {
      throw unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    const user: AuthUser = { id: row.id, username: row.username, role: row.role, displayName: row.display_name };
    res.json({ token: signToken(user), user });
  }),
);

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'),
});

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const row = await get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!row || !bcrypt.compareSync(currentPassword, row.password_hash)) {
      throw badRequest('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user!.id]);
    await audit(req.user!.id, 'password_change', 'user', req.user!.id);
    res.json({ ok: true });
  }),
);

// JWT is stateless; logout just records an audit entry. The client discards the token.
authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    await audit(req.user!.id, 'logout', 'user', req.user!.id);
    res.json({ ok: true });
  }),
);
