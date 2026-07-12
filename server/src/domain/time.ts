// Date/time helpers. The server runs with TZ=Asia/Bangkok (set via npm scripts),
// so local Date methods reflect Thai time. Thailand has no DST, so day/hour math
// is straightforward.

/**
 * Return a new Date on `base`'s calendar day shifted by `dayOffset`, set to
 * exactly `hour`:00:00.000 local time.
 */
export function atHourOnOffsetDay(base: Date, dayOffset: number, hour: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** ISO-ish local string "YYYY-MM-DD HH:mm:ss" for storage / display. */
export function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Local business date "YYYY-MM-DD". */
export function businessDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
