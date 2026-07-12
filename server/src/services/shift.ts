import { get, run } from '../db/index.js';
import { businessDate } from '../domain/time.js';
import { conflict, notFound } from '../util/http.js';
import { audit } from '../util/audit.js';

export interface ShiftRow {
  id: number;
  business_date: string;
  opening_float: number;
  opened_by: number;
  opened_at: Date;
  closing_count: number | null;
  expected_cash: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  closed_by: number | null;
  closed_at: Date | null;
}

export async function getCurrentShift(): Promise<ShiftRow | null> {
  const row = await get<ShiftRow>("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
  return row ?? null;
}

export interface ShiftSummary {
  shift: ShiftRow;
  cashTotal: number;
  qrTotal: number;
  missingSlips: number;
  expectedCash: number;
}

export async function getShiftSummary(shiftId: number): Promise<ShiftSummary> {
  const shift = await get<ShiftRow>('SELECT * FROM shifts WHERE id = ?', [shiftId]);
  if (!shift) throw notFound('ไม่พบกะการทำงาน');
  const cash = (await get<{ t: string }>(
    "SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE shift_id = ? AND method = 'cash'",
    [shiftId],
  ))!;
  const qr = (await get<{ t: string }>(
    "SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE shift_id = ? AND method = 'qr'",
    [shiftId],
  ))!;
  const missing = (await get<{ n: string }>(
    "SELECT COUNT(*) AS n FROM payments WHERE shift_id = ? AND method = 'qr' AND (slip_image_path IS NULL OR slip_image_path = '')",
    [shiftId],
  ))!;
  return {
    shift,
    cashTotal: Number(cash.t),
    qrTotal: Number(qr.t),
    missingSlips: Number(missing.n),
    expectedCash: shift.opening_float + Number(cash.t),
  };
}

export async function openShift(userId: number, isManager: boolean, openingFloat: number): Promise<ShiftRow> {
  if (await getCurrentShift()) throw conflict('มีกะที่เปิดอยู่แล้ว');
  const float = isManager ? Math.max(0, Math.trunc(openingFloat)) : 0;
  const res = await run('INSERT INTO shifts(business_date, opening_float, opened_by) VALUES (?, ?, ?) RETURNING id', [
    businessDate(),
    float,
    userId,
  ]);
  await audit(userId, 'shift_open', 'shift', Number(res.rows[0]!.id), `float=${float}`);
  return (await getCurrentShift())!;
}

/** Manager-only: adjust the opening change float. */
export async function setFloat(shiftId: number, openingFloat: number, userId: number): Promise<ShiftRow> {
  const shift = await get<ShiftRow>('SELECT * FROM shifts WHERE id = ?', [shiftId]);
  if (!shift) throw notFound('ไม่พบกะการทำงาน');
  if (shift.status !== 'open') throw conflict('กะปิดแล้ว แก้ไขเงินตั้งต้นไม่ได้');
  await run('UPDATE shifts SET opening_float = ? WHERE id = ?', [Math.max(0, Math.trunc(openingFloat)), shiftId]);
  await audit(userId, 'shift_set_float', 'shift', shiftId, `float=${openingFloat}`);
  return (await get<ShiftRow>('SELECT * FROM shifts WHERE id = ?', [shiftId]))!;
}

export async function closeShift(shiftId: number, closingCount: number, userId: number): Promise<ShiftRow> {
  const summary = await getShiftSummary(shiftId);
  if (summary.shift.status !== 'open') throw conflict('กะนี้ปิดแล้ว');
  if (summary.missingSlips > 0) {
    throw conflict(`ปิดกะไม่ได้: มีการชำระแบบ QR ${summary.missingSlips} รายการที่ยังไม่ได้แนบสลิป`);
  }
  const count = Math.max(0, Math.trunc(closingCount));
  const variance = count - summary.expectedCash;
  await run(
    "UPDATE shifts SET closing_count = ?, expected_cash = ?, variance = ?, status = 'closed', closed_by = ?, closed_at = ? WHERE id = ?",
    [count, summary.expectedCash, variance, userId, new Date(), shiftId],
  );
  await audit(userId, 'shift_close', 'shift', shiftId, `variance=${variance}`);
  return (await get<ShiftRow>('SELECT * FROM shifts WHERE id = ?', [shiftId]))!;
}
