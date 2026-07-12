import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { applySchema, get, run, closePool } from './index.js';
import { DEFAULT_SETTINGS } from '../config.js';

await applySchema();

// --- Settings -------------------------------------------------------------
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  await run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', [key, value]);
}

// --- Rooms: A1..A10, B1..B10 ---------------------------------------------
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
  console.log('✓ seeded 20 rooms (A1–A10, B1–B10)');
}

// --- Default users --------------------------------------------------------
const userCount = (await get<{ n: string }>('SELECT COUNT(*) AS n FROM users'))!;
if (Number(userCount.n) === 0) {
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
  console.log('✓ seeded users: manager/manager123, staff/staff123');
}

// --- Sample products ------------------------------------------------------
const productCount = (await get<{ n: string }>('SELECT COUNT(*) AS n FROM products'))!;
if (Number(productCount.n) === 0) {
  const samples: Array<[string, number, string]> = [
    ['น้ำเปล่า', 10, 'เครื่องดื่ม'],
    ['น้ำอัดลม', 20, 'เครื่องดื่ม'],
    ['เบียร์', 60, 'เครื่องดื่ม'],
    ['บะหมี่กึ่งสำเร็จรูป', 25, 'อาหาร'],
    ['ขนมขบเคี้ยว', 20, 'อาหาร'],
    ['ถุงยางอนามัย', 30, 'ของใช้'],
    ['ผ้าเช็ดตัวเพิ่ม', 50, 'ของใช้'],
  ];
  for (const [name, price, category] of samples) {
    await run('INSERT INTO products(name, price, category) VALUES (?, ?, ?)', [name, price, category]);
  }
  console.log('✓ seeded sample products');
}

console.log('✓ seed complete');
await closePool();
