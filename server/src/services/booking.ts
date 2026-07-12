import { all, get, run } from '../db/index.js';
import { getPricing } from '../repositories/settings.js';
import { overnightCharge, shortStayCharge, shouldOfferOvernight } from '../domain/pricing/index.js';
import { atHourOnOffsetDay } from '../domain/time.js';
import { ApiError, badRequest, conflict, notFound } from '../util/http.js';
import { audit } from '../util/audit.js';

export interface BookingRow {
  id: number;
  room_id: number;
  type: 'short' | 'overnight';
  license_plate: string | null;
  province: string | null;
  check_in_at: Date;
  expected_checkout_at: Date;
  actual_checkout_at: Date | null;
  base_amount: number;
  extension_hours: number;
  extension_amount: number;
  early_checkin_fee: number;
  converted_overnight: number;
  room_total: number;
  status: 'active' | 'closed' | 'void';
  created_by: number;
  created_at: Date;
  closed_at: Date | null;
}

async function getBookingRow(id: number): Promise<BookingRow> {
  const row = await get<BookingRow>('SELECT * FROM bookings WHERE id = ?', [id]);
  if (!row) throw notFound('ไม่พบรายการเข้าพัก');
  return row;
}

function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 3600_000);
}

export interface CheckInInput {
  roomId: number;
  type: 'short' | 'overnight';
  licensePlate?: string | null;
  province?: string | null;
  payEarlyExtend?: boolean;
  userId: number;
}

/** Check a guest into a room, creating an active booking. */
export async function checkIn(input: CheckInInput): Promise<BookingRow> {
  const cfg = await getPricing();
  const room = await get<{ id: number; status: string; cleaning_status: string; label: string }>(
    'SELECT id, status, cleaning_status, label FROM rooms WHERE id = ?',
    [input.roomId],
  );
  if (!room) throw notFound('ไม่พบห้องพัก');
  if (room.status !== 'available') throw conflict(`ห้อง ${room.label} ไม่ว่าง`);
  if (room.cleaning_status !== 'clean') throw conflict(`ห้อง ${room.label} ยังไม่ได้ทำความสะอาด`);

  const now = new Date();
  let baseAmount: number;
  let earlyFee = 0;
  let roomTotal: number;
  let expectedCheckout: Date;

  if (input.type === 'short') {
    const charge = shortStayCharge(0, cfg);
    baseAmount = charge.baseAmount;
    roomTotal = charge.total;
    expectedCheckout = addHours(now, cfg.shortBaseHours);
  } else {
    const charge = overnightCharge(now, Boolean(input.payEarlyExtend), cfg);
    baseAmount = charge.price;
    earlyFee = charge.earlyCheckinFee;
    roomTotal = charge.total;
    expectedCheckout = charge.expectedCheckoutAt;
  }

  const res = await run(
    `INSERT INTO bookings
       (room_id, type, license_plate, province, check_in_at, expected_checkout_at,
        base_amount, extension_hours, extension_amount, early_checkin_fee, room_total, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?) RETURNING id`,
    [
      input.roomId,
      input.type,
      input.licensePlate ?? null,
      input.province ?? null,
      now,
      expectedCheckout,
      baseAmount,
      earlyFee,
      roomTotal,
      input.userId,
    ],
  );
  const bookingId = Number(res.rows[0]!.id);

  await run("UPDATE rooms SET status = 'occupied', current_booking_id = ? WHERE id = ?", [bookingId, input.roomId]);
  await audit(input.userId, 'checkin', 'booking', bookingId, `${room.label} ${input.type}`);
  return getBookingRow(bookingId);
}

export interface ExtendResult {
  booking: BookingRow;
  offerOvernight: boolean;
}

/** Add one extension block to a short-stay booking. */
export async function extendShortStay(bookingId: number, userId: number): Promise<ExtendResult> {
  const cfg = await getPricing();
  const booking = await getBookingRow(bookingId);
  if (booking.status !== 'active') throw conflict('รายการนี้ปิดแล้ว');
  if (booking.type !== 'short' || booking.converted_overnight) {
    throw badRequest('ต่อเวลาได้เฉพาะการเข้าพักแบบชั่วคราว');
  }

  const units = booking.extension_hours / cfg.shortExtHours + 1;
  const charge = shortStayCharge(units, cfg);
  const newExpected = addHours(new Date(booking.expected_checkout_at), cfg.shortExtHours);

  await run(
    `UPDATE bookings SET extension_hours = ?, extension_amount = ?, room_total = ?, expected_checkout_at = ? WHERE id = ?`,
    [charge.extensionHours, charge.extensionAmount, charge.total, newExpected, bookingId],
  );
  await run('INSERT INTO booking_extensions(booking_id, hours, amount, created_by) VALUES (?, ?, ?, ?)', [
    bookingId,
    cfg.shortExtHours,
    cfg.shortExtPrice,
    userId,
  ]);

  await audit(userId, 'extend', 'booking', bookingId, `+${cfg.shortExtHours}h`);
  return { booking: await getBookingRow(bookingId), offerOvernight: shouldOfferOvernight(charge, cfg) };
}

/** Manually convert an active short stay into the flat overnight rate. */
export async function convertToOvernight(bookingId: number, userId: number): Promise<BookingRow> {
  const cfg = await getPricing();
  const booking = await getBookingRow(bookingId);
  if (booking.status !== 'active') throw conflict('รายการนี้ปิดแล้ว');
  if (booking.type !== 'short' || booking.converted_overnight) {
    throw badRequest('แปลงเป็นค้างคืนได้เฉพาะการเข้าพักแบบชั่วคราว');
  }

  const expectedCheckout = atHourOnOffsetDay(new Date(booking.check_in_at), 1, cfg.overnightCheckoutHour);
  await run('UPDATE bookings SET converted_overnight = 1, room_total = ?, base_amount = ?, expected_checkout_at = ? WHERE id = ?', [
    cfg.overnightPrice,
    cfg.overnightPrice,
    expectedCheckout,
    bookingId,
  ]);

  await audit(userId, 'convert', 'booking', bookingId, 'short→overnight');
  return getBookingRow(bookingId);
}

export interface Folio {
  booking: BookingRow;
  roomLabel: string;
  supplementaryTotal: number;
  grandTotal: number;
  items: Array<{ id: number; name: string; qty: number; unit_price: number; line_total: number; source: string }>;
}

export async function getFolio(bookingId: number): Promise<Folio> {
  const booking = await getBookingRow(bookingId);
  const room = (await get<{ label: string }>('SELECT label FROM rooms WHERE id = ?', [booking.room_id]))!;
  const items = await getSaleItems(bookingId);
  const supplementaryTotal = items.reduce((s, i) => s + i.line_total, 0);
  return {
    booking,
    roomLabel: room.label,
    items,
    supplementaryTotal,
    grandTotal: booking.room_total + supplementaryTotal,
  };
}

function getSaleItems(bookingId: number): Promise<Folio['items']> {
  return all<Folio['items'][number]>(
    'SELECT id, name, qty, unit_price, line_total, source FROM sale_items WHERE booking_id = ? ORDER BY id',
    [bookingId],
  );
}

/** Close a booking and mark the room dirty for housekeeping. */
export async function checkOut(bookingId: number, userId: number): Promise<Folio> {
  const booking = await getBookingRow(bookingId);
  if (booking.status !== 'active') throw conflict('รายการนี้ปิดแล้ว');
  const now = new Date();

  await run("UPDATE bookings SET status = 'closed', actual_checkout_at = ?, closed_at = ? WHERE id = ?", [
    now,
    now,
    bookingId,
  ]);
  await run("UPDATE rooms SET status = 'available', cleaning_status = 'dirty', current_booking_id = NULL WHERE id = ?", [
    booking.room_id,
  ]);

  await audit(userId, 'checkout', 'booking', bookingId);
  return getFolio(bookingId);
}

export async function voidBooking(bookingId: number, userId: number): Promise<void> {
  const booking = await getBookingRow(bookingId);
  if (booking.status === 'closed') throw conflict('ปิดรายการแล้ว ไม่สามารถยกเลิกได้');
  await run("UPDATE bookings SET status = 'void', closed_at = ? WHERE id = ?", [new Date(), bookingId]);
  await run("UPDATE rooms SET status = 'available', cleaning_status = 'dirty', current_booking_id = NULL WHERE id = ?", [
    booking.room_id,
  ]);
  await audit(userId, 'void', 'booking', bookingId);
}

export { getBookingRow };
export { ApiError };
