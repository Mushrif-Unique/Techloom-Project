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
  let stopped = false;
  let timer;
  let pending = Promise.resolve();
  const tick = () => {
    pending = (async () => {
      let delay = Math.min(env.EXPIRY_INTERVAL_MS, 1000);
      try {
        // Drain overdue batches, then schedule against the next database deadline.
        while (!stopped && (await expireBatch()) === 100) {
          /* next batch */
        }
        if (stopped) return;
        const [next] =
          await db.$queryRaw`SELECT EXTRACT(EPOCH FROM (MIN("expiresAt") - clock_timestamp())) * 1000 AS delay FROM "Reservation" WHERE status = 'ACTIVE'`;
        if (next.delay !== null)
          delay = Math.max(1, Math.min(delay, Number(next.delay)));
      } finally {
        if (!stopped) {
          timer = setTimeout(tick, delay);
          timer.unref();
        }
      }
    })().catch((error) =>
      logger.error(
        { event: 'expiration_error', code: error.code },
        'Expiration batch failed',
      ),
    );
  };
  tick();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await pending;
  };
}
