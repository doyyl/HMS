import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { config } from './config.js';
import { applySchema } from './db/index.js';
import { ApiError } from './util/http.js';

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

// Ensure schema exists on boot.
await applySchema();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

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

// Serve the built SPA in production (web/dist), with client-side routing fallback.
const webDist = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

// Centralised error handler with Thai-friendly messages.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', details: err.flatten() });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
};
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`HMS server listening on http://0.0.0.0:${config.port}`);
});
