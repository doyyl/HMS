import express, { type Express, type ErrorRequestHandler, type RequestHandler } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { config } from './config.js';
import { ping } from './db/index.js';
import { sweepReservations } from './services/reservation.js';
import { ApiError } from './util/http.js';
import { logger } from './util/logger.js';

import { authRouter } from './routes/auth.js';
import { roomsRouter } from './routes/rooms.js';
import { bookingsRouter } from './routes/bookings.js';
import { productsRouter } from './routes/products.js';
import { salesRouter } from './routes/sales.js';
import { ordersRouter } from './routes/orders.js';
import { publicRouter } from './routes/public.js';
import { paymentsRouter } from './routes/payments.js';
import { shiftsRouter } from './routes/shifts.js';
import { reportsRouter } from './routes/reports.js';
import { settingsRouter } from './routes/settings.js';
import { usersRouter } from './routes/users.js';
import { reservationsRouter } from './routes/reservations.js';

/** Build the Express app (no listening, no schema apply — safe for tests). */
export function createApp(): Express {
  const app = express();

  // Behind a proxy (Supabase/Render/Nginx) — trust X-Forwarded-* so rate-limit
  // and secure cookies see the real client IP.
  app.set('trust proxy', 1);

  // Structured request logging (silenced under test).
  if (config.nodeEnv !== 'test') app.use(pinoHttp({ logger }));

  // Security headers. CSP is disabled here because the SPA + external payment
  // redirects need a bespoke policy; helmet's other defaults still apply.
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS: allowlist in production, reflect any origin in dev.
  const corsOptions: CorsOptions = {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    credentials: true,
  };
  app.use(cors(corsOptions));

  app.use(express.json({ limit: '1mb' }));

  // Rate limiters. Strict on auth (brute-force), moderate on public endpoints.
  // Disabled under test so the suite isn't throttled.
  if (config.nodeEnv !== 'test') {
    const authLimiter = rateLimit({
      windowMs: 60_000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่' },
    });
    const publicLimiter = rateLimit({
      windowMs: 60_000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'คำขอบ่อยเกินไป กรุณารอสักครู่' },
    });
    app.use('/api/auth', authLimiter);
    app.use('/api/public', publicLimiter);
  }

  // Deep health check: verifies the database is reachable (for load balancers).
  app.get('/api/health', async (_req, res) => {
    try {
      await ping();
      res.json({ ok: true, db: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, db: 'down', time: new Date().toISOString() });
    }
  });

  // Reservation sweep — invoked by Vercel Cron (replaces the setInterval on
  // always-on hosts). Protected by CRON_SECRET when set.
  app.get('/api/cron/sweep', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    try {
      await sweepReservations();
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'sweep failed' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/shifts', shiftsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/reservations', reservationsRouter);

  // Unmatched API routes return JSON 404 (not the SPA fallback below).
  const apiNotFound: RequestHandler = (_req, res) => {
    res.status(404).json({ error: 'ไม่พบรายการที่ต้องการ' });
  };
  app.use('/api', apiNotFound);

  // Serve the built SPA in production (web/dist), with client-side routing fallback.
  const webDist = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  // Centralised error handler with Thai-friendly messages.
  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof ZodError) {
      // Only expose field-level details outside production.
      const body: { error: string; details?: unknown } = { error: 'ข้อมูลไม่ถูกต้อง' };
      if (!config.isProduction) body.details = err.flatten();
      res.status(400).json(body);
      return;
    }
    req.log?.error({ err }, 'unhandled error');
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
  };
  app.use(errorHandler);

  return app;
}
