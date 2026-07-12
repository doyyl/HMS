import { get } from '../db/index.js';
import { badRequest } from '../util/http.js';

export type Period = 'day' | 'month' | 'year';

const TZ = 'Asia/Bangkok';

interface PeriodFilter {
  clause: (col: string) => string;
  param: string;
  label: string;
}

function periodFilter(period: Period, date: string): PeriodFilter {
  // `date` is YYYY-MM-DD. Timestamps are UTC; we group by Bangkok-local calendar.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)');
  const local = (c: string) => `(${c} AT TIME ZONE '${TZ}')`;
  switch (period) {
    case 'day':
      return { clause: (c) => `${local(c)}::date = ?::date`, param: date, label: date };
    case 'month':
      return { clause: (c) => `to_char(${local(c)}, 'YYYY-MM') = ?`, param: date.slice(0, 7), label: date.slice(0, 7) };
    case 'year':
      return { clause: (c) => `to_char(${local(c)}, 'YYYY') = ?`, param: date.slice(0, 4), label: date.slice(0, 4) };
    default:
      throw badRequest('ช่วงเวลาไม่ถูกต้อง');
  }
}

export interface ReportResult {
  period: Period;
  label: string;
  received: { cash: number; qr: number; total: number };
  charges: { roomShort: number; roomOvernight: number; supplementary: number; total: number };
  bookings: number;
}

export async function buildReport(period: Period, date: string): Promise<ReportResult> {
  const f = periodFilter(period, date);

  const pay = (await get<{ cash: string; qr: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN method='cash' THEN amount END),0) AS cash,
       COALESCE(SUM(CASE WHEN method='qr'   THEN amount END),0) AS qr
     FROM payments WHERE ${f.clause('created_at')}`,
    [f.param],
  ))!;

  const rooms = (await get<{ room_short: string; room_overnight: string; n: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type='short' AND converted_overnight=0 THEN room_total END),0) AS room_short,
       COALESCE(SUM(CASE WHEN type='overnight' OR converted_overnight=1 THEN room_total END),0) AS room_overnight,
       COUNT(*) AS n
     FROM bookings WHERE status='closed' AND ${f.clause('closed_at')}`,
    [f.param],
  ))!;

  const supp = (await get<{ t: string }>(
    `SELECT COALESCE(SUM(line_total),0) AS t FROM sale_items WHERE ${f.clause('created_at')}`,
    [f.param],
  ))!;

  const cash = Number(pay.cash);
  const qr = Number(pay.qr);
  const roomShort = Number(rooms.room_short);
  const roomOvernight = Number(rooms.room_overnight);
  const supplementary = Number(supp.t);
  return {
    period,
    label: f.label,
    received: { cash, qr, total: cash + qr },
    charges: { roomShort, roomOvernight, supplementary, total: roomShort + roomOvernight + supplementary },
    bookings: Number(rooms.n),
  };
}
