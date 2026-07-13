// Vercel Cron target: expires stale reservation holds and flags no-shows.
// Replaces the always-on setInterval sweep (which serverless can't run).
process.env.TZ = process.env.TZ || 'Asia/Bangkok';

import type { IncomingMessage, ServerResponse } from 'node:http';
// @ts-expect-error — built JS has no d.ts; resolved at Vercel build time.
import { sweepReservations } from '../../server/dist/services/reservation.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.statusCode = 401;
    return res.end('unauthorized');
  }
  try {
    await sweepReservations();
    res.statusCode = 200;
    res.end('swept');
  } catch {
    res.statusCode = 500;
    res.end('sweep failed');
  }
}
