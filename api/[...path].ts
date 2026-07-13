// Vercel serverless entry for the whole HMS API. All /api/* requests (except the
// cron route) are handled here by the compiled Express app. The app is built to
// server/dist by the Vercel buildCommand before this function is bundled.

// Serverless runs UTC by default; force Bangkok so pricing/time math is correct.
process.env.TZ = process.env.TZ || 'Asia/Bangkok';

import type { IncomingMessage, ServerResponse } from 'node:http';
// @ts-ignore — built JS has no d.ts; resolved at Vercel build time.
import { createApp } from '../server/dist/app.js';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Ensure the Express /api/* routers see the full path regardless of how
  // Vercel maps the catch-all.
  if (req.url && !req.url.startsWith('/api')) req.url = '/api' + req.url;
  return (app as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
