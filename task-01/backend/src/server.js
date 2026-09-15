import { app } from './app.js';
import { db } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { startExpirationWorker } from './jobs/expiration.js';
let server;
let stopWorker = async () => {};
let stopping = false;
async function shutdown(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  logger.info({ event: 'shutdown', signal }, 'Shutting down');
  const deadline = setTimeout(() => process.exit(1), 25000);
  deadline.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  await stopWorker();
  await db.$disconnect();
  clearTimeout(deadline);
  process.exit(exitCode);
}
try {
  await db.$connect();
  stopWorker = startExpirationWorker();
  server = app.listen(env.PORT, () =>
    logger.info({ port: env.PORT }, 'POS API ready'),
  );
  server.on('error', () => shutdown('server_error', 1));
} catch {
  logger.error(
    { event: 'startup_error' },
    'Cannot connect to database or start API',
  );
  await shutdown('startup_error', 1);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', () => shutdown('unhandledRejection', 1));
process.on('uncaughtException', () => shutdown('uncaughtException', 1));
