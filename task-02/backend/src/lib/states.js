import {
  CheckoutStatus,
  PaymentStatus,
  ReservationStatus,
  OrderStatus,
  RefundStatus,
} from '@prisma/client';
import { assert } from './errors.js';
export const S = {
  checkout: CheckoutStatus,
  payment: PaymentStatus,
  reservation: ReservationStatus,
  order: OrderStatus,
  refund: RefundStatus,
};
const transitions = {
  checkout: {
    RESERVED: ['PAYMENT_PROCESSING', 'EXPIRED', 'CANCELLED'],
    PAYMENT_PROCESSING: ['COMPLETED', 'PAYMENT_FAILED', 'PAYMENT_TIMEOUT'],
    PAYMENT_TIMEOUT: ['PAYMENT_FAILED'],
  },
  payment: {
    PENDING: ['PROCESSING'],
    PROCESSING: ['SUCCESS', 'FAILED', 'TIMEOUT'],
    TIMEOUT: ['FAILED'],
  },
  reservation: { ACTIVE: ['CONSUMED', 'RELEASED', 'EXPIRED'] },
  order: {
    CONFIRMED: ['CANCELLED', 'FAILED'],
    CANCELLED: ['REFUND_PENDING'],
    FAILED: ['REFUND_PENDING'],
    REFUND_PENDING: ['REFUNDED'],
  },
  refund: { PENDING: ['PROCESSING'], PROCESSING: ['SUCCESS', 'FAILED'] },
};
export function transition(type, from, to) {
  assert(
    transitions[type]?.[from]?.includes(to),
    409,
    'INVALID_TRANSITION',
    `Cannot change ${type} from ${from} to ${to}.`,
  );
  return to;
}
