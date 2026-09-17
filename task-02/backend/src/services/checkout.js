import { db, Prisma, transaction } from '../db.js';
import { config } from '../config.js';
import { assert } from '../lib/errors.js';
import { S, transition } from '../lib/states.js';
import { cleanup, release, reconcileTimeout } from './inventory.js';
import { log } from '../lib/log.js';
export const checkoutInclude = {
  reservations: true,
  payment: true,
  order: { select: { id: true, status: true } },
};
export async function ownedCheckout(tx, userId, id, include = checkoutInclude) {
  const checkout = await tx.checkoutSession.findFirst({ where: { id, userId }, include });
  assert(checkout, 404, 'CHECKOUT_NOT_FOUND', 'Checkout not found.');
  return checkout;
}
export async function getCheckout(userId, id) {
  await cleanup();
  return ownedCheckout(db, userId, id);
}
export async function createCheckout(userId, idempotencyKey) {
  await cleanup();
  const checkout = await transaction(async (tx) => {
    const previous = await tx.checkoutSession.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: checkoutInclude,
    });
    if (previous) return previous;
    const active = await tx.checkoutSession.findFirst({
      where: {
        userId,
        status: {
          in: [S.checkout.RESERVED, S.checkout.PAYMENT_PROCESSING, S.checkout.PAYMENT_TIMEOUT],
        },
      },
      include: checkoutInclude,
    });
    if (active) return active;
    const cart = await tx.cart.findUniqueOrThrow({
      where: { userId },
      include: { items: { include: { product: true }, orderBy: { productId: 'asc' } } },
    });
    assert(cart.items.length, 409, 'EMPTY_CART', 'Add something to your bag before checking out.');
    const items = [];
    let total = new Prisma.Decimal(0);
    for (const item of cart.items) {
      const p = item.product;
      assert(p.active, 409, 'PRODUCT_UNAVAILABLE', `${p.name} is no longer available.`);
      const updated =
        await tx.$executeRaw`UPDATE "Product" SET "reservedQuantity" = "reservedQuantity" + ${item.quantity}, "updatedAt" = NOW() WHERE id = ${p.id}::uuid AND active = true AND "stockQuantity" - "reservedQuantity" >= ${item.quantity}`;
      assert(updated === 1, 409, 'INSUFFICIENT_STOCK', `Not enough available stock for ${p.name}.`);
      const lineTotal = p.price.mul(item.quantity);
      total = total.add(lineTotal);
      items.push({
        productId: p.id,
        productName: p.name,
        imageUrl: p.imageUrl,
        unitPrice: p.price.toFixed(2),
        quantity: item.quantity,
        lineTotal: lineTotal.toFixed(2),
        cartItemId: item.id,
        cartItemUpdatedAt: item.updatedAt.toISOString(),
      });
    }
    const expiresAt = new Date(Date.now() + config.RESERVATION_TTL_MINUTES * 60000);
    return tx.checkoutSession.create({
      data: {
        userId,
        idempotencyKey,
        totalAmount: total,
        items,
        expiresAt,
        reservations: {
          create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, expiresAt })),
        },
      },
      include: checkoutInclude,
    });
  });
  log('checkout.reserved', { checkoutId: checkout.id, userId });
  return checkout;
}
export async function cancelCheckout(userId, id) {
  await cleanup();
  const result = await transaction(async (tx) => {
    const checkout = await ownedCheckout(tx, userId, id);
    if (
      [S.checkout.CANCELLED, S.checkout.EXPIRED, S.checkout.PAYMENT_FAILED].includes(
        checkout.status,
      )
    )
      return checkout;
    if (checkout.status === S.checkout.PAYMENT_TIMEOUT) {
      await reconcileTimeout(tx, checkout);
      return ownedCheckout(tx, userId, id);
    }
    assert(
      checkout.status === S.checkout.RESERVED,
      409,
      'CHECKOUT_NOT_CANCELLABLE',
      'This checkout cannot be cancelled. Paid orders can be cancelled from your orders.',
    );
    await release(tx, checkout);
    await tx.checkoutSession.update({
      where: { id },
      data: { status: transition('checkout', checkout.status, S.checkout.CANCELLED) },
    });
    return ownedCheckout(tx, userId, id);
  });
  log('checkout.cancelled', { checkoutId: id });
  return result;
}
