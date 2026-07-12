import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../util/http.js';
import { buildReport, type Period } from '../services/reports.js';
import { businessDate } from '../domain/time.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// GET /api/reports?period=day|month|year&date=YYYY-MM-DD  (both roles may view)
reportsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const period = (req.query.period as Period) ?? 'day';
    const date = (req.query.date as string) ?? businessDate();
    res.json(await buildReport(period, date));
  }),
);
