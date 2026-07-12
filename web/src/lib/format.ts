/** Format integer baht with thousands separators, e.g. 1500 -> "฿1,500". */
export function baht(n: number | null | undefined): string {
  if (n == null) return '฿0';
  return `฿${n.toLocaleString('th-TH')}`;
}

/** Parse a stored local timestamp "YYYY-MM-DD HH:mm:ss" into a Date. */
export function parseLocal(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s.replace(' ', 'T'));
}

const TIME_FMT = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
const DATETIME_FMT = new Intl.DateTimeFormat('th-TH', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function timeOf(s: string | null | undefined): string {
  const d = parseLocal(s);
  return d ? TIME_FMT.format(d) : '–';
}

export function dateTimeOf(s: string | null | undefined): string {
  const d = parseLocal(s);
  return d ? DATETIME_FMT.format(d) : '–';
}

/** Human countdown like "เหลือ 2 ชม. 15 น." or "เกินเวลา 30 น." */
export function untilLabel(target: string | null | undefined, now: Date = new Date()): { text: string; overdue: boolean } {
  const d = parseLocal(target);
  if (!d) return { text: '–', overdue: false };
  const diffMin = Math.round((d.getTime() - now.getTime()) / 60000);
  const overdue = diffMin < 0;
  const mins = Math.abs(diffMin);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts = h > 0 ? `${h} ชม. ${m} น.` : `${m} น.`;
  return { text: overdue ? `เกินเวลา ${parts}` : `เหลือ ${parts}`, overdue };
}
