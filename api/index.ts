// Single Vercel serverless entry for the whole HMS API. vercel.json rewrites
// /api/* to this function; the Express app (built to server/dist) handles every
// route, including /api/cron/sweep. Loaded via dynamic import() so this CommonJS
// function can consume the ESM build without ERR_REQUIRE_ESM.

// Serverless runs UTC by default; force Bangkok so pricing/time math is correct.
process.env.TZ = process.env.TZ || 'Asia/Bangkok';

import type { IncomingMessage, ServerResponse } from 'node:http';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let appPromise: Promise<Handler> | null = null;

async function getApp(): Promise<Handler> {
  if (!appPromise) {
    appPromise = import('../server/dist/app.js').then((m) => m.createApp() as Handler);
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // The Express routers are mounted under /api/*; ensure the path is intact
  // regardless of how the rewrite forwards the request.
  if (req.url && !req.url.startsWith('/api')) req.url = '/api' + req.url;
  const app = await getApp();
  return app(req, res);
}
