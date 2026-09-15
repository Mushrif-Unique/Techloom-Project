import { randomUUID } from 'node:crypto';
import {
  transaction,
  lockOrder,
  readOrder,
} from '../repositories/transactions.js';
import { expireIfDue } from './orders.js';
import { settleReservations } from './inventory.js';
import { transition } from '../constants/lifecycle.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
export async function payOrder(id, outcome, idempotencyKey) {
  const result = await transaction(async (tx) => {
    // Globally serialize the key, including accidental reuse against different orders.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))::text`;
    const order = await lockOrder(tx, id);
    const previous = await tx.payment.findUnique({ where: { idempotencyKey } });
    if (previous) {
      if (previous.orderId !== id || previous.outcome !== outcome)
        throw new AppError(
          'IDEMPOTENCY_KEY_REUSED',
          'This key belongs to a different payment request.',
        );
      return {
        order: await readOrder(tx, id),
        payment: previous,
        replayed: true,
      };
    }
    if (await expireIfDue(tx, order))
      return { expired: true, order: await readOrder(tx, id) };
    if (order.status !== 'RESERVED')
      throw new AppError(
        order.status === 'PAID'
          ? 'ORDER_ALREADY_PAID'
          : 'INVALID_ORDER_TRANSITION',
        `Cannot pay an order in ${order.status} status.`,
      );
    const reservations = await tx.reservation.findMany({
      where: { orderId: id },
    });
    if (!reservations.length || reservations.some((r) => r.status !== 'ACTIVE'))
      throw new AppError(
        'INVALID_RESERVATION',
        'Order has no valid active reservation.',
      );
    const status = {
      success: 'SUCCESS',
      failure: 'FAILED',
      timeout: 'TIMEOUT',
    }[outcome];
    const payment = await tx.payment.create({
      data: {
        orderId: id,
        idempotencyKey,
        outcome,
        status,
        providerReference: `mock_${randomUUID()}`,
      },
    });
    await settleReservations(
      tx,
      id,
      { success: 'CONSUMED', failure: 'RELEASED', timeout: 'EXPIRED' }[outcome],
    );
    await transition(
      tx,
      order,
      { success: 'PAID', failure: 'FAILED', timeout: 'EXPIRED' }[outcome],
    );
    return { order: await readOrder(tx, id), payment, replayed: false };
  });
  logger.info(
    {
      event: 'payment',
      orderId: id,
      status: result.payment?.status ?? 'EXPIRED',
      replayed: result.replayed,
    },
    'Mock payment handled',
  );
  return result;
}
