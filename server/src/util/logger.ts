import { pino } from 'pino';
import { config } from '../config.js';

// Structured logger. Pretty in dev, JSON in prod for log aggregation.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.isProduction ? 'info' : 'debug'),
  transport: config.isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
