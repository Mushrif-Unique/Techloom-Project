import {
  transaction,
  lockCart,
  databaseNow,
  readOrder,
} from '../repositories/transactions.js';
import { reserveInventory } from './inventory.js';
import { transition, RESERVATION_MS } from '../constants/lifecycle.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { releaseDueInventory } from './orders.js';
export async function checkout(cartId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await checkoutAttempt(cartId);
    } catch (error) {
      if (error.code !== 'INVENTORY_EXPIRY_RETRY') throw error;
    }
  }
  throw new AppError(
    'DATABASE_BUSY',
    'Inventory is changing. Please retry checkout.',
    503,
  );
}
async function checkoutAttempt(cartId) {
  await releaseDueInventory();
  const result = await transaction(async (tx) => {
    const cart = await lockCart(tx, cartId);
    const existing = await tx.order.findUnique({ where: { cartId } });
    if (existing)
      throw new AppError(
        'DUPLICATE_ORDER',
        'This cart already has an order. Open Orders to view it.',
      );
    if (cart.status !== 'ACTIVE')
      throw new AppError(
        'CART_ALREADY_CHECKED_OUT',
        'Cart already checked out.',
      );
    const items = await tx.cartItem.findMany({
      where: { cartId },
      orderBy: { productId: 'asc' },
    });
    if (!items.length)
      throw new AppError('EMPTY_CART', 'Add products before checking out.');
    const { snapshots, totalAmount } = await reserveInventory(tx, items);
    const createdAt = await databaseNow(tx);
    const order = await tx.order.create({
      data: {
        cartId,
        totalAmount,
        status: 'PENDING',
        createdAt,
        items: { create: snapshots },
      },
    });
    await tx.reservation.createMany({
      data: items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + RESERVATION_MS),
      })),
    });
    await tx.cart.update({
      where: { id: cartId },
      data: { status: 'CHECKED_OUT' },
    });
    await transition(tx, order, 'RESERVED');
    return readOrder(tx, order.id);
  });
  logger.info(
    { event: 'checkout', orderId: result.id, status: result.status },
    'Checkout completed',
  );
  return result;
}
