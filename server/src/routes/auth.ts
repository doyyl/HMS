import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { get } from '../db/index.js';
import { signToken, requireAuth, type AuthUser } from '../middleware/auth.js';
import { asyncHandler, unauthorized } from '../util/http.js';

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
