import { config } from './config.js';
import { applySchema, closePool } from './db/index.js';
import { logger } from './util/logger.js';
import { createApp } from './app.js';
import { sweepReservations } from './services/reservation.js';

// Ensure schema exists on boot.
await applySchema();

const app = createApp();

// Periodically expire stale holds and flag no-shows (lazy expiry also runs on read).
const sweepTimer = setInterval(() => {
  sweepReservations().catch((err) => logger.error({ err }, 'reservation sweep failed'));
}, 60_000);
sweepTimer.unref();

const server = app.listen(config.port, () => {
  logger.info(`HMS server listening on http://0.0.0.0:${config.port}`);
});

// Graceful shutdown: stop accepting connections, then drain the pg pool.
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down`);
  server.close(async () => {
    await closePool();
    logger.info('shutdown complete');
    process.exit(0);
  });
  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
