import { randomUUID } from 'node:crypto';
import { all, get, run } from '../db/index.js';
import { getPricing, getAllSettings } from '../repositories/settings.js';
import { businessDate } from '../domain/time.js';
import { badRequest, conflict, notFound } from '../util/http.js';
import { audit } from '../util/audit.js';
import { nightsBetween, isRoomAvailable } from './availability.js';

export interface ReservationRow {
  id: number;
  code: string;
  room_id: number;
  room_label?: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  amount: number;
  status: 'pending_payment' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'expired' | 'no_show';
  hold_expires_at: Date | null;
  booking_id: number | null;
  manage_token: string;
  source: 'online' | 'phone' | 'walkin';
  created_at: Date;
}

function genCode(): string {
  const d = businessDate().replace(/-/g, '').slice(2); // YYMMDD
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `R-${d}-${rand}`;
}

export async function getReservationById(id: number): Promise<ReservationRow> {
  const row = await get<ReservationRow>(
    'SELECT res.*, r.label AS room_label FROM reservations res JOIN rooms r ON r.id = res.room_id WHERE res.id = ?',
    [id],
  );
  if (!row) throw notFound('ไม่พบการจอง');
  return row;
}

export async function getReservationByCode(code: string): Promise<ReservationRow | undefined> {
  return get<ReservationRow>(
    'SELECT res.*, r.label AS room_label FROM reservations res JOIN rooms r ON r.id = res.room_id WHERE res.code = ?',
    [code],
  );
}

export interface CreateReservationInput {
  roomId: number;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string | null;
  source?: 'online' | 'phone';
  /** 'confirmed' for staff/phone bookings; 'pending_payment' for online (awaits 2C2P). */
  status?: 'confirmed' | 'pending_payment';
  userId?: number;
}

export async function createReservation(input: CreateReservationInput): Promise<ReservationRow> {
  const nights = nightsBetween(input.checkInDate, input.checkOutDate);
  if (input.checkInDate < businessDate()) throw badRequest('เลือกวันเช็คอินย้อนหลังไม่ได้');

  const cfg = await getPricing();
  const amount = nights * cfg.overnightPrice;

  if (!(await isRoomAvailable(input.roomId, input.checkInDate, input.checkOutDate))) {
    throw conflict('ห้องนี้ไม่ว่างในช่วงวันที่เลือก');
  }

  const status = input.status ?? 'confirmed';
  const source = input.source ?? 'phone';
  const settings = await getAllSettings();
  const holdMinutes = Number(settings.RESERVATION_HOLD_MINUTES ?? '15');
  const holdExpires = status === 'pending_payment' ? new Date(Date.now() + holdMinutes * 60_000) : null;
  const code = genCode();
  const manageToken = randomUUID();

  try {
    const res = await run(
      `INSERT INTO reservations
         (code, room_id, check_in_date, check_out_date, nights, guest_name, guest_phone, guest_email,
          amount, status, hold_expires_at, manage_token, source)
       VALUES (?, ?, ?::date, ?::date, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        code,
        input.roomId,
        input.checkInDate,
        input.checkOutDate,
        nights,
        input.guestName,
        input.guestPhone,
        input.guestEmail ?? null,
        amount,
        status,
        holdExpires,
        manageToken,
        source,
      ],
    );
    const id = Number(res.rows[0]!.id);
    await audit(input.userId ?? null, 'reservation_create', 'reservation', id, `${code} ${input.checkInDate}→${input.checkOutDate}`);
    return getReservationById(id);
  } catch (err) {
    // Real-Postgres EXCLUDE constraint backstop against a concurrent double-book.
    if (err instanceof Error && /reservations_no_overlap|exclusion|duplicate/i.test(err.message)) {
      throw conflict('ห้องนี้เพิ่งถูกจองไปแล้ว กรุณาเลือกห้องอื่น');
    }
    throw err;
  }
}

export async function cancelReservation(id: number, userId: number): Promise<void> {
  const r = await getReservationById(id);
  if (['checked_in', 'completed', 'cancelled'].includes(r.status)) {
    throw conflict('สถานะการจองนี้ยกเลิกไม่ได้');
  }
  await run("UPDATE reservations SET status = 'cancelled', updated_at = now() WHERE id = ?", [id]);
  await audit(userId, 'reservation_cancel', 'reservation', id);
}

export async function markNoShow(id: number, userId: number): Promise<void> {
  const r = await getReservationById(id);
  if (r.status !== 'confirmed') throw conflict('ทำเครื่องหมายไม่มาได้เฉพาะการจองที่ยืนยันแล้ว');
  await run("UPDATE reservations SET status = 'no_show', updated_at = now() WHERE id = ?", [id]);
  await audit(userId, 'reservation_no_show', 'reservation', id);
}

/**
 * Check a confirmed reservation into the room: creates a normal booking (so
 * checkout/folio/ordering work unchanged), records any prepaid amount, and
 * occupies the room.
 */
export async function checkInReservation(id: number, userId: number): Promise<{ bookingId: number }> {
  const r = await getReservationById(id);
  if (r.status !== 'confirmed') throw conflict('เช็คอินได้เฉพาะการจองที่ยืนยันแล้ว');
  // DATE columns may come back as strings or Date objects depending on driver.
  const checkInDay = businessDate(new Date(r.check_in_date));
  if (checkInDay > businessDate()) throw badRequest('ยังไม่ถึงวันเช็คอินของการจองนี้');

  const room = await get<{ id: number; status: string; cleaning_status: string; label: string }>(
    'SELECT id, status, cleaning_status, label FROM rooms WHERE id = ?',
    [r.room_id],
  );
  if (!room) throw notFound('ไม่พบห้องพัก');
  if (room.status === 'occupied') throw conflict(`ห้อง ${room.label} มีผู้เข้าพักอยู่`);
  if (room.cleaning_status !== 'clean') throw conflict(`ห้อง ${room.label} ยังไม่ได้ทำความสะอาด`);

  const cfg = await getPricing();
  const now = new Date();
  const checkout = new Date(r.check_out_date);
  checkout.setHours(cfg.overnightCheckoutHour, 0, 0, 0);

  const booking = await run(
    `INSERT INTO bookings
       (room_id, type, check_in_at, expected_checkout_at, base_amount, extension_hours,
        extension_amount, early_checkin_fee, room_total, created_by)
     VALUES (?, 'overnight', ?, ?, ?, 0, 0, 0, ?, ?) RETURNING id`,
    [r.room_id, now, checkout, r.amount, r.amount, userId],
  );
  const bookingId = Number(booking.rows[0]!.id);

  // If the reservation was prepaid online, record it as an online payment so the
  // folio shows paid and cash reconciliation is untouched (shift_id NULL).
  const paid = await get<{ n: string }>(
    "SELECT COUNT(*) AS n FROM gateway_payments WHERE reservation_id = ? AND status = 'success'",
    [id],
  );
  if (Number(paid!.n) > 0) {
    await run(
      `INSERT INTO payments (booking_id, shift_id, amount, method, receipt_type, created_by)
       VALUES (?, NULL, ?, 'online', 'none', ?)`,
      [bookingId, r.amount, userId],
    );
  }

  await run("UPDATE rooms SET status = 'occupied', current_booking_id = ? WHERE id = ?", [bookingId, r.room_id]);
  await run("UPDATE reservations SET status = 'checked_in', booking_id = ?, updated_at = now() WHERE id = ?", [
    bookingId,
    id,
  ]);
  await audit(userId, 'reservation_checkin', 'reservation', id, `booking=${bookingId}`);
  return { bookingId };
}

export async function listReservations(status?: string): Promise<ReservationRow[]> {
  if (status) {
    return all<ReservationRow>(
      'SELECT res.*, r.label AS room_label FROM reservations res JOIN rooms r ON r.id = res.room_id WHERE res.status = ? ORDER BY res.check_in_date, res.id',
      [status],
    );
  }
  return all<ReservationRow>(
    "SELECT res.*, r.label AS room_label FROM reservations res JOIN rooms r ON r.id = res.room_id WHERE res.status IN ('pending_payment','confirmed','checked_in') ORDER BY res.check_in_date, res.id",
  );
}

/** Confirmed reservations arriving today (staff arrivals panel). */
export async function arrivalsToday(): Promise<ReservationRow[]> {
  return all<ReservationRow>(
    "SELECT res.*, r.label AS room_label FROM reservations res JOIN rooms r ON r.id = res.room_id WHERE res.status = 'confirmed' AND res.check_in_date = ?::date ORDER BY r.building, r.number",
    [businessDate()],
  );
}

/**
 * Background sweep: expire stale unpaid holds, and flag confirmed reservations
 * whose arrival day has fully passed (never checked in) as no-shows.
 */
export async function sweepReservations(): Promise<void> {
  await run(
    "UPDATE reservations SET status = 'expired', updated_at = now() WHERE status = 'pending_payment' AND hold_expires_at IS NOT NULL AND hold_expires_at < now()",
  );
  await run(
    "UPDATE reservations SET status = 'no_show', updated_at = now() WHERE status = 'confirmed' AND check_out_date <= ?::date",
    [businessDate()],
  );
}
