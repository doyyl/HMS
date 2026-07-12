import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { applySchema, run, get } from '../src/db/index.js';
import { DEFAULT_SETTINGS } from '../src/config.js';
import { createApp } from '../src/app.js';

export interface TestContext {
  app: Express;
  managerToken: string;
  staffToken: string;
}

/** Fresh in-process DB (pglite) + seeded base data + a running app. */
export async function setupTest(): Promise<TestContext> {
  await applySchema();

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', [key, value]);
  }

  const roomCount = (await get<{ n: string }>('SELECT COUNT(*) AS n FROM rooms'))!;
  if (Number(roomCount.n) === 0) {
    for (const building of ['A', 'B'] as const) {
      for (let n = 1; n <= 10; n += 1) {
        await run('INSERT INTO rooms(building, number, label, order_token) VALUES (?, ?, ?, ?)', [
          building,
          n,
          `${building}${n}`,
          randomUUID(),
        ]);
      }
    }
  }

  await run('INSERT INTO users(username, password_hash, role, display_name) VALUES (?, ?, ?, ?)', [
    'manager',
    bcrypt.hashSync('manager123', 10),
    'manager',
    'ผู้จัดการ',
  ]);
  await run('INSERT INTO users(username, password_hash, role, display_name) VALUES (?, ?, ?, ?)', [
    'staff',
    bcrypt.hashSync('staff123', 10),
    'staff',
    'พนักงาน',
  ]);

  await run('INSERT INTO products(name, price, category) VALUES (?, ?, ?)', ['น้ำเปล่า', 10, 'เครื่องดื่ม']);

  const app = createApp();
  const managerToken = await login(app, 'manager', 'manager123');
  const staffToken = await login(app, 'staff', 'staff123');
  return { app, managerToken, staffToken };
}

export async function login(app: Express, username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed (${res.status}): ${res.text}`);
  return res.body.token as string;
}

/** Room id by label, e.g. 'A1'. */
export async function roomIdByLabel(label: string): Promise<number> {
  const row = (await get<{ id: number }>('SELECT id FROM rooms WHERE label = ?', [label]))!;
  return row.id;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
