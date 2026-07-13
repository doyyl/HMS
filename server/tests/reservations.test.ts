import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { setupTest, roomIdByLabel, auth } from './helpers.js';
import { businessDate } from '../src/domain/time.js';

let app: Express;
let managerToken: string;
let staffToken: string;

// Helpers for relative Bangkok dates.
function dayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return businessDate(d);
}

beforeAll(async () => {
  const ctx = await setupTest();
  app = ctx.app;
  managerToken = ctx.managerToken;
  staffToken = ctx.staffToken;
});

describe('availability', () => {
  it('lists all rooms when nothing is booked', async () => {
    const res = await request(app)
      .get('/api/reservations/availability')
      .query({ checkIn: dayOffset(3), checkOut: dayOffset(4) })
      .set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(res.body.rooms.length).toBe(20);
  });

  it('rejects an invalid date range', async () => {
    const res = await request(app)
      .get('/api/reservations/availability')
      .query({ checkIn: dayOffset(4), checkOut: dayOffset(3) })
      .set(auth(staffToken));
    expect(res.status).toBe(400);
  });
});

describe('reservation lifecycle', () => {
  it('creates a reservation, blocks overlaps, and prices by nights', async () => {
    const roomId = await roomIdByLabel('A5');
    const create = await request(app)
      .post('/api/reservations')
      .set(auth(staffToken))
      .send({
        roomId,
        checkInDate: dayOffset(5),
        checkOutDate: dayOffset(8), // 3 nights
        guestName: 'สมชาย',
        guestPhone: '0810000000',
      });
    expect(create.status).toBe(201);
    expect(create.body.reservation.nights).toBe(3);
    expect(create.body.reservation.amount).toBe(1500); // 3 x 500
    expect(create.body.reservation.status).toBe('confirmed');

    // Same room, overlapping range → the room is no longer available.
    const avail = await request(app)
      .get('/api/reservations/availability')
      .query({ checkIn: dayOffset(6), checkOut: dayOffset(7) })
      .set(auth(staffToken));
    expect(avail.body.rooms.some((r: { id: number }) => r.id === roomId)).toBe(false);

    // Booking the overlapping range on that room is rejected.
    const clash = await request(app)
      .post('/api/reservations')
      .set(auth(staffToken))
      .send({ roomId, checkInDate: dayOffset(6), checkOutDate: dayOffset(7), guestName: 'ก', guestPhone: '02' });
    expect(clash.status).toBe(409);

    // A non-overlapping later range on the same room is fine.
    const ok = await request(app)
      .post('/api/reservations')
      .set(auth(staffToken))
      .send({ roomId, checkInDate: dayOffset(8), checkOutDate: dayOffset(9), guestName: 'ข', guestPhone: '03' });
    expect(ok.status).toBe(201);
  });

  it('checks a reservation in today and produces a working booking', async () => {
    const roomId = await roomIdByLabel('A6');
    const create = await request(app)
      .post('/api/reservations')
      .set(auth(staffToken))
      .send({
        roomId,
        checkInDate: businessDate(),
        checkOutDate: dayOffset(1),
        guestName: 'อารีย์',
        guestPhone: '0899999999',
      });
    const reservationId = create.body.reservation.id;

    // A walk-in cannot steal the reserved room today.
    const walkIn = await request(app).post('/api/bookings').set(auth(staffToken)).send({ roomId, type: 'overnight' });
    expect(walkIn.status).toBe(409);

    // Staff checks the reservation in.
    const checkin = await request(app).post(`/api/reservations/${reservationId}/check-in`).set(auth(staffToken));
    expect(checkin.status).toBe(200);
    const bookingId = checkin.body.bookingId;

    // Room is occupied and the booking carries the prepaid amount as room total.
    const rooms = await request(app).get('/api/rooms').set(auth(staffToken));
    const a6 = rooms.body.rooms.find((r: { label: string }) => r.label === 'A6');
    expect(a6.status).toBe('occupied');
    expect(a6.current_booking_id).toBe(bookingId);

    const folio = await request(app).get(`/api/bookings/${bookingId}/folio`).set(auth(staffToken));
    expect(folio.body.booking.room_total).toBe(500);

    // Checkout works through the normal flow.
    const checkout = await request(app).post(`/api/bookings/${bookingId}/checkout`).set(auth(staffToken));
    expect(checkout.status).toBe(200);
  });

  it('cancels a reservation', async () => {
    const roomId = await roomIdByLabel('A7');
    const create = await request(app)
      .post('/api/reservations')
      .set(auth(staffToken))
      .send({ roomId, checkInDate: dayOffset(10), checkOutDate: dayOffset(11), guestName: 'ด', guestPhone: '05' });
    const id = create.body.reservation.id;

    const cancel = await request(app).post(`/api/reservations/${id}/cancel`).set(auth(staffToken));
    expect(cancel.status).toBe(200);

    // Room is available again for that range.
    const avail = await request(app)
      .get('/api/reservations/availability')
      .query({ checkIn: dayOffset(10), checkOut: dayOffset(11) })
      .set(auth(staffToken));
    expect(avail.body.rooms.some((r: { id: number }) => r.id === roomId)).toBe(true);
  });
});
