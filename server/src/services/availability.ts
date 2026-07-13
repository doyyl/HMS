import { all, run } from '../db/index.js';
import { businessDate } from '../domain/time.js';
import { badRequest } from '../util/http.js';

// Reservation statuses that block a room's date range.
export const BLOCKING_STATUSES = ['pending_payment', 'confirmed', 'checked_in'] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AvailableRoom {
  id: number;
  building: string;
  number: number;
  label: string;
}

/** Whole days between two YYYY-MM-DD dates (checkout exclusive). */
export function nightsBetween(checkInDate: string, checkOutDate: string): number {
  if (!DATE_RE.test(checkInDate) || !DATE_RE.test(checkOutDate)) {
    throw badRequest('รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)');
  }
  const inMs = Date.parse(`${checkInDate}T00:00:00`);
  const outMs = Date.parse(`${checkOutDate}T00:00:00`);
  const nights = Math.round((outMs - inMs) / 86_400_000);
  if (nights < 1) throw badRequest('วันที่เช็คเอาท์ต้องมาหลังวันเช็คอินอย่างน้อย 1 คืน');
  return nights;
}

/** Flip stale unpaid holds to 'expired'. Called before any availability read. */
export async function expireStaleHolds(): Promise<void> {
  await run(
    "UPDATE reservations SET status = 'expired', updated_at = now() WHERE status = 'pending_payment' AND hold_expires_at IS NOT NULL AND hold_expires_at < now()",
  );
}

/**
 * Rooms free for the whole [checkInDate, checkOutDate) range: no overlapping
 * blocking reservation, and — when arriving today — not currently occupied by a
 * walk-in booking.
 */
export async function availableRooms(checkInDate: string, checkOutDate: string): Promise<AvailableRoom[]> {
  nightsBetween(checkInDate, checkOutDate);
  await expireStaleHolds();

  const arrivingToday = checkInDate === businessDate();
  const rows = await all<AvailableRoom>(
    `SELECT r.id, r.building, r.number, r.label
       FROM rooms r
      WHERE r.id NOT IN (
              SELECT room_id FROM reservations
               WHERE status IN ('pending_payment', 'confirmed', 'checked_in')
                 AND check_in_date < ?::date
                 AND check_out_date > ?::date
            )
        ${arrivingToday ? "AND r.status <> 'occupied'" : ''}
      ORDER BY r.building, r.number`,
    [checkOutDate, checkInDate],
  );
  return rows;
}

/** True if a specific room is free for the range. */
export async function isRoomAvailable(roomId: number, checkInDate: string, checkOutDate: string): Promise<boolean> {
  const rooms = await availableRooms(checkInDate, checkOutDate);
  return rooms.some((r) => r.id === roomId);
}
