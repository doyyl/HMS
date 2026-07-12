import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { setupTest, roomIdByLabel, auth } from './helpers.js';
import { run, get } from '../src/db/index.js';

let app: Express;
let managerToken: string;
let staffToken: string;

beforeAll(async () => {
  const ctx = await setupTest();
  app = ctx.app;
  managerToken = ctx.managerToken;
  staffToken = ctx.staffToken;
});

describe('auth', () => {
  it('rejects bad credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'manager', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const res = await request(app).get('/api/auth/me').set(auth(managerToken));
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('manager');
  });

  it('requires auth without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('changes password only with the correct current password', async () => {
    const bad = await request(app)
      .post('/api/auth/change-password')
      .set(auth(staffToken))
      .send({ currentPassword: 'nope', newPassword: 'longenough123' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post('/api/auth/change-password')
      .set(auth(staffToken))
      .send({ currentPassword: 'staff123', newPassword: 'newstaffpass123' });
    expect(ok.status).toBe(200);

    const relogin = await request(app).post('/api/auth/login').send({ username: 'staff', password: 'newstaffpass123' });
    expect(relogin.status).toBe(200);
  });
});

describe('booking lifecycle', () => {
  it('checks in, extends, converts, and checks out a short stay', async () => {
    const roomId = await roomIdByLabel('A1');

    const checkin = await request(app)
      .post('/api/bookings')
      .set(auth(staffToken))
      .send({ roomId, type: 'short' });
    expect(checkin.status).toBe(201);
    const bookingId = checkin.body.booking.id;
    expect(checkin.body.booking.room_total).toBe(200);

    // Room now shows occupied.
    const rooms = await request(app).get('/api/rooms').set(auth(staffToken));
    const a1 = rooms.body.rooms.find((r: { label: string }) => r.label === 'A1');
    expect(a1.status).toBe('occupied');

    const extend = await request(app).post(`/api/bookings/${bookingId}/extend`).set(auth(staffToken));
    expect(extend.status).toBe(200);
    expect(extend.body.booking.room_total).toBe(250); // 200 + 1x50

    const convert = await request(app).post(`/api/bookings/${bookingId}/convert-overnight`).set(auth(staffToken));
    expect(convert.status).toBe(200);
    expect(convert.body.booking.room_total).toBe(500);

    const checkout = await request(app).post(`/api/bookings/${bookingId}/checkout`).set(auth(staffToken));
    expect(checkout.status).toBe(200);
    expect(checkout.body.booking.status).toBe('closed');

    // Room freed and marked dirty.
    const after = await request(app).get('/api/rooms').set(auth(staffToken));
    const a1After = after.body.rooms.find((r: { label: string }) => r.label === 'A1');
    expect(a1After.status).toBe('available');
    expect(a1After.cleaning_status).toBe('dirty');
  });

  it('refuses to check into an occupied room', async () => {
    const roomId = await roomIdByLabel('A2');
    const first = await request(app).post('/api/bookings').set(auth(staffToken)).send({ roomId, type: 'overnight' });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/bookings').set(auth(staffToken)).send({ roomId, type: 'overnight' });
    expect(second.status).toBe(409);
  });
});

describe('shift + payments', () => {
  it('opens a shift, records payments, voids one, and reconciles', async () => {
    // Manager opens a shift with a 1000 float.
    const open = await request(app).post('/api/shifts/open').set(auth(managerToken)).send({ opening_float: 1000 });
    expect(open.status).toBe(201);

    // Two cash payments of 300 and 200.
    const p1 = await request(app)
      .post('/api/payments')
      .set(auth(staffToken))
      .field('amount', '300')
      .field('method', 'cash')
      .field('receiptType', 'none');
    expect(p1.status).toBe(201);
    const p2 = await request(app)
      .post('/api/payments')
      .set(auth(staffToken))
      .field('amount', '200')
      .field('method', 'cash')
      .field('receiptType', 'none');
    expect(p2.status).toBe(201);

    let cur = await request(app).get('/api/shifts/current').set(auth(managerToken));
    expect(cur.body.summary.cashTotal).toBe(500);
    expect(cur.body.summary.expectedCash).toBe(1500); // 1000 float + 500 cash

    // Void the 200 payment — staff is forbidden, manager allowed.
    const forbid = await request(app).post(`/api/payments/${p2.body.id}/void`).set(auth(staffToken)).send({});
    expect(forbid.status).toBe(403);
    const voided = await request(app).post(`/api/payments/${p2.body.id}/void`).set(auth(managerToken)).send({ reason: 'ทดสอบ' });
    expect(voided.status).toBe(200);

    // Reconciliation now excludes the voided payment.
    cur = await request(app).get('/api/shifts/current').set(auth(managerToken));
    expect(cur.body.summary.cashTotal).toBe(300);
    expect(cur.body.summary.expectedCash).toBe(1300);

    // Voiding twice fails.
    const again = await request(app).post(`/api/payments/${p2.body.id}/void`).set(auth(managerToken)).send({});
    expect(again.status).toBe(400);

    // Close the shift counting exactly the expected cash — zero variance.
    const shiftId = cur.body.shift.id;
    const close = await request(app).post(`/api/shifts/${shiftId}/close`).set(auth(managerToken)).send({ closing_count: 1300 });
    expect(close.status).toBe(200);
    expect(close.body.shift.variance).toBe(0);
  });
});

describe('customer orders', () => {
  async function seedOrder(roomLabel: string): Promise<{ orderId: number; bookingId: number }> {
    const roomId = await roomIdByLabel(roomLabel);
    const checkin = await request(app).post('/api/bookings').set(auth(staffToken)).send({ roomId, type: 'overnight' });
    const bookingId = checkin.body.booking.id as number;
    const product = (await get<{ id: number; name: string; price: number }>('SELECT id, name, price FROM products LIMIT 1'))!;
    const order = await run(
      "INSERT INTO customer_orders(room_id, booking_id, status) VALUES (?, ?, 'pending') RETURNING id",
      [roomId, bookingId],
    );
    const orderId = Number(order.rows[0]!.id);
    await run('INSERT INTO customer_order_items(order_id, product_id, name, qty, unit_price) VALUES (?, ?, ?, ?, ?)', [
      orderId,
      product.id,
      product.name,
      2,
      product.price,
    ]);
    return { orderId, bookingId };
  }

  it('accepts an order and adds its items to the folio', async () => {
    const { orderId, bookingId } = await seedOrder('B1');
    const res = await request(app).post(`/api/orders/${orderId}/accept`).set(auth(staffToken));
    expect(res.status).toBe(200);

    const folio = await request(app).get(`/api/bookings/${bookingId}/folio`).set(auth(staffToken));
    expect(folio.body.supplementaryTotal).toBe(20); // 2 x 10
    expect(folio.body.items).toHaveLength(1);
  });

  it('rejects a pending order without touching the folio', async () => {
    const { orderId, bookingId } = await seedOrder('B2');
    const res = await request(app).post(`/api/orders/${orderId}/reject`).set(auth(staffToken));
    expect(res.status).toBe(200);

    const row = await get<{ status: string }>('SELECT status FROM customer_orders WHERE id = ?', [orderId]);
    expect(row!.status).toBe('rejected');
    const folio = await request(app).get(`/api/bookings/${bookingId}/folio`).set(auth(staffToken));
    expect(folio.body.items).toHaveLength(0);
  });
});
