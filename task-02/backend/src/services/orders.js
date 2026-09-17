import { db, transaction } from '../db.js';
import { assert } from '../lib/errors.js';
import { S, transition } from '../lib/states.js';
import { refund } from './gateway.js';
import { log } from '../lib/log.js';
const include = {
  items: true,
  refund: true,
  history: { orderBy: { sequence: 'asc' } },
  checkout: {
    select: {
      createdAt: true,
      expiresAt: true,
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          transactionReference: true,
          createdAt: true,
        },
      },
    },
  },
};
export async function getOrder(userId, id, tx = db) {
  const order = await tx.order.findFirst({ where: { id, userId }, include });
  assert(order, 404, 'ORDER_NOT_FOUND', 'Order not found.');
  return order;
}
export function listOrders(userId) {
  return db.order.findMany({ where: { userId }, include, orderBy: { createdAt: 'desc' } });
}
// Shared transactional reversal for customer cancellation and simulated fulfilment failure.
export async function refundPaidOrder(tx, userId, id, reason, cause = S.order.CANCELLED) {
  let order = await getOrder(userId, id, tx);
  if (order.status === S.order.REFUNDED) return order;
  assert(
    order.status === S.order.CONFIRMED && order.checkout.payment.status === S.payment.SUCCESS,
    409,
    'ORDER_NOT_CANCELLABLE',
    'This order cannot be cancelled.',
  );
  assert(
    [S.order.CANCELLED, S.order.FAILED].includes(cause),
    409,
    'INVALID_REFUND_CAUSE',
    'Invalid refund cause.',
  );
  const steps = [
    [
      cause,
      cause === S.order.FAILED
        ? 'Order failed after successful payment: simulated fulfilment failure. Inventory restored.'
        : 'Cancellation requested. Inventory restored.',
    ],
    [S.order.REFUND_PENDING, 'Mock refund processing.'],
    [S.order.REFUNDED, 'Refund successful. Full payment returned.'],
  ];
  for (const item of [...order.items].sort((a, b) => a.productId.localeCompare(b.productId)))
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQuantity: { increment: item.quantity } },
    });
  let record = await tx.refund.create({
    data: {
      orderId: id,
      paymentId: order.checkout.payment.id,
      amount: order.totalAmount,
      reason,
    },
  });
  record = await tx.refund.update({
    where: { id: record.id },
    data: { status: transition('refund', record.status, S.refund.PROCESSING) },
  });
  const outcome = refund(order.checkout.payment);
  await tx.refund.update({
    where: { id: record.id },
    data: { ...outcome, status: transition('refund', record.status, outcome.status) },
  });
  const sequenceStart = order.history.length + 1;
  for (let i = 0; i < steps.length; i++) {
    const [next, note] = steps[i];
    order = await tx.order.update({
      where: { id },
      data: {
        status: transition('order', order.status, next),
        history: { create: { status: next, note, sequence: sequenceStart + i } },
      },
    });
  }
  return getOrder(userId, id, tx);
}
export async function cancelOrder(userId, id, reason) {
  const result = await transaction((tx) => refundPaidOrder(tx, userId, id, reason));
  log('order.refunded', { orderId: id, refundId: result.refund.id });
  return result;
}
