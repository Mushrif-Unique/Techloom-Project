import { AppError } from '../utils/errors.js';
export const RESERVATION_MS = 5 * 60 * 1000;
export const transitions = Object.freeze({
  PENDING: ['RESERVED'],
  RESERVED: ['PAID', 'FAILED', 'EXPIRED', 'CANCELLED'],
  PAID: ['CANCELLED'],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
});
export function assertTransition(from, to) {
  if (!transitions[from]?.includes(to)) {
    throw new AppError(
      'INVALID_ORDER_TRANSITION',
      `Cannot change order from ${from} to ${to}.`,
    );
  }
}
export async function transition(tx, order, status) {
  assertTransition(order.status, status);
  return tx.order.update({ where: { id: order.id }, data: { status } });
}
