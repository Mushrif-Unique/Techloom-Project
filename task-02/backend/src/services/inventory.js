import { db, transaction } from '../db.js';
import { transition, S } from '../lib/states.js';
import { log } from '../lib/log.js';
export async function release(tx, checkout, target = S.reservation.RELEASED) {
  const reservations = await tx.stockReservation.findMany({
    where: { checkoutSessionId: checkout.id, status: S.reservation.ACTIVE },
    orderBy: { productId: 'asc' },
  });
  for (const r of reservations) {
    await tx.stockReservation.update({
      where: { id: r.id },
      data: { status: transition('reservation', r.status, target) },
    });
    await tx.product.update({
      where: { id: r.productId },
      data: { reservedQuantity: { decrement: r.quantity } },
    });
  }
}
// The mock's timeout scenario always reconciles to NOT_CHARGED. No new charge is attempted.
export async function reconcileTimeout(tx, checkout) {
  const p = await tx.payment.findUniqueOrThrow({ where: { checkoutSessionId: checkout.id } });
  await tx.payment.update({
    where: { id: p.id },
    data: {
      status: transition('payment', p.status, S.payment.FAILED),
      failureReason: 'Reconciled: gateway confirms no charge. Start a new checkout.',
    },
  });
  await release(tx, checkout);
  return tx.checkoutSession.update({
    where: { id: checkout.id },
    data: { status: transition('checkout', checkout.status, S.checkout.PAYMENT_FAILED) },
  });
}
export async function cleanup() {
  const candidates = await db.checkoutSession.findMany({
    where: {
      status: { in: [S.checkout.RESERVED, S.checkout.PAYMENT_TIMEOUT] },
      expiresAt: { lte: new Date() },
    },
    select: { id: true },
    take: 100,
    orderBy: { expiresAt: 'asc' },
  });
  for (const { id } of candidates) {
    const changed = await transaction(async (tx) => {
      const checkout = await tx.checkoutSession.findUnique({ where: { id } });
      if (checkout.expiresAt > new Date()) return false;
      if (checkout.status === S.checkout.PAYMENT_TIMEOUT) {
        await reconcileTimeout(tx, checkout);
        return true;
      }
      if (checkout.status !== S.checkout.RESERVED) return false;
      await release(tx, checkout, S.reservation.EXPIRED);
      await tx.checkoutSession.update({
        where: { id },
        data: { status: transition('checkout', checkout.status, S.checkout.EXPIRED) },
      });
      return true;
    });
    if (changed) log('reservation.expired', { checkoutId: id });
  }
  return candidates.length;
}
