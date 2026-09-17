import { transaction, Prisma } from '../db.js';
import { assert } from '../lib/errors.js';
import { S, transition } from '../lib/states.js';
import { cleanup, release, reconcileTimeout } from './inventory.js';
import { ownedCheckout } from './checkout.js';
import { scenarioFor, charge } from './gateway.js';
import { log } from '../lib/log.js';
import { refundPaidOrder } from './orders.js';
export async function pay(userId, id, idempotencyKey, cardNumber) {
  log('payment.attempt', { checkoutId: id, userId });
  await cleanup();
  const scenario = scenarioFor(cardNumber);
  const result = await transaction(async (tx) => {
    const checkout = await ownedCheckout(tx, userId, id);
    const previous = await tx.payment.findUnique({ where: { idempotencyKey } });
    if (previous) {
      assert(
        previous.checkoutSessionId === id && previous.scenario === scenario,
        409,
        'IDEMPOTENCY_CONFLICT',
        'This payment key was already used with a different request.',
      );
      return checkout;
    }
    assert(
      !checkout.payment,
      409,
      'PAYMENT_EXISTS',
      'A payment attempt already exists. Check its result or reconcile it; do not submit a new charge.',
    );
    assert(
      checkout.status === S.checkout.RESERVED && checkout.expiresAt > new Date(),
      409,
      'CHECKOUT_NOT_PAYABLE',
      'This reservation has ended. Please start a new checkout.',
    );
    assert(
      checkout.reservations.length === checkout.items.length &&
        checkout.reservations.every((r) => r.status === S.reservation.ACTIVE),
      409,
      'INVALID_RESERVATION',
      'Your reservation is no longer active.',
    );
    const total = checkout.items.reduce(
      (sum, i) => sum.add(new Prisma.Decimal(i.unitPrice).mul(i.quantity)),
      new Prisma.Decimal(0),
    );
    assert(
      total.equals(checkout.totalAmount),
      409,
      'AMOUNT_MISMATCH',
      'Checkout amount could not be confirmed.',
    );
    await tx.checkoutSession.update({
      where: { id },
      data: { status: transition('checkout', checkout.status, S.checkout.PAYMENT_PROCESSING) },
    });
    let payment = await tx.payment.create({
      data: { checkoutSessionId: id, amount: total, idempotencyKey, scenario },
    });
    payment = await tx.payment.update({
      where: { id: payment.id },
      data: { status: transition('payment', payment.status, S.payment.PROCESSING) },
    });
    const outcome = charge(scenario, payment.id);
    await tx.payment.update({
      where: { id: payment.id },
      data: { ...outcome, status: transition('payment', payment.status, outcome.status) },
    });
    if (outcome.status === S.payment.SUCCESS) {
      for (const r of [...checkout.reservations].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )) {
        await tx.product.update({
          where: { id: r.productId },
          data: {
            stockQuantity: { decrement: r.quantity },
            reservedQuantity: { decrement: r.quantity },
          },
        });
        await tx.stockReservation.update({
          where: { id: r.id },
          data: { status: transition('reservation', r.status, S.reservation.CONSUMED) },
        });
      }
      const order = await tx.order.create({
        data: {
          userId,
          checkoutSessionId: id,
          totalAmount: total,
          items: {
            create: checkout.items.map(({ cartItemId, cartItemUpdatedAt, ...item }) => item),
          },
          history: {
            create: {
              status: S.order.CONFIRMED,
              sequence: 1,
              note: 'Payment successful. Your order is confirmed.',
            },
          },
        },
      });
      if (scenario === 'ORDER_FAILURE') {
        await refundPaidOrder(
          tx,
          userId,
          order.id,
          'Automatic full refund: simulated order failure after successful payment.',
          S.order.FAILED,
        );
      }
      // Preserve anything the customer changed in the bag after starting checkout.
      for (const item of checkout.items)
        await tx.cartItem.deleteMany({
          where: {
            id: item.cartItemId,
            updatedAt: new Date(item.cartItemUpdatedAt),
            quantity: item.quantity,
          },
        });
    } else if (outcome.status === S.payment.FAILED) await release(tx, checkout);
    const next = {
      SUCCESS: S.checkout.COMPLETED,
      FAILED: S.checkout.PAYMENT_FAILED,
      TIMEOUT: S.checkout.PAYMENT_TIMEOUT,
    }[outcome.status];
    await tx.checkoutSession.update({
      where: { id },
      data: { status: transition('checkout', S.checkout.PAYMENT_PROCESSING, next) },
    });
    return ownedCheckout(tx, userId, id);
  });
  log('payment.result', {
    checkoutId: id,
    paymentId: result.payment.id,
    status: result.payment.status,
    orderId: result.order?.id,
    orderStatus: result.order?.status,
  });
  return result;
}
export async function reconcile(userId, id) {
  const result = await transaction(async (tx) => {
    const checkout = await ownedCheckout(tx, userId, id);
    if (checkout.status === S.checkout.PAYMENT_TIMEOUT) await reconcileTimeout(tx, checkout);
    return ownedCheckout(tx, userId, id);
  });
  log('payment.reconciled', { checkoutId: id, status: result.payment?.status });
  return result;
}
