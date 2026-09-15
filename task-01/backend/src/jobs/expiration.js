import { db } from '../config/db.js';
import { transaction, lockOrder } from '../repositories/transactions.js';
import { expireIfDue } from '../services/orders.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
export async function expireBatch() {
  const rows =
    await db.$queryRaw`SELECT DISTINCT "orderId" FROM "Reservation" WHERE status = 'ACTIVE' AND "expiresAt" <= clock_timestamp() ORDER BY "orderId" LIMIT 100`;
  let expired = 0;
  for (const row of rows) {
    const changed = await transaction(async (tx) =>
      expireIfDue(tx, await lockOrder(tx, row.orderId)),
    );
    if (changed) {
      expired++;
      logger.info(
        { event: 'expiration', orderId: row.orderId },
        'Reservation expired and inventory restored',
      );
    }
  }
  return expired;
}
export function startExpirationWorker() {
  let running = false;
  let pending = Promise.resolve();
  const tick = () => {
    if (running) return;
    running = true;
    pending = expireBatch()
      .catch((error) =>
        logger.error(
          { event: 'expiration_error', code: error.code },
          'Expiration batch failed',
        ),
      )
      .finally(() => {
        running = false;
      });
  };
  const timer = setInterval(tick, env.EXPIRY_INTERVAL_MS);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await pending;
  };
}
