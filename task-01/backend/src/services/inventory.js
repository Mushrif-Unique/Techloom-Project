import { lockProducts } from '../repositories/transactions.js';
import { AppError } from '../utils/errors.js';
export async function reserveInventory(tx, items) {
  const products = await lockProducts(
    tx,
    items.map((item) => item.productId),
  );
  const byId = new Map(products.map((product) => [product.id, product]));
  // A reservation can expire while checkout waits for product locks. Roll back
  // before taking order locks, then let checkout release it and retry safely.
  const now = (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
  const due = await tx.reservation.findFirst({
    where: {
      productId: { in: items.map((item) => item.productId) },
      status: 'ACTIVE',
      expiresAt: { lte: now },
    },
  });
  if (due)
    throw new AppError(
      'INVENTORY_EXPIRY_RETRY',
      'Expired inventory needs restoration.',
    );
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product?.isActive || product.stock < item.quantity) {
      throw new AppError(
        'INSUFFICIENT_STOCK',
        'Insufficient stock for one or more products.',
      );
    }
  }
  const snapshots = items.map((item) => {
    const product = byId.get(item.productId);
    return {
      productId: product.id,
      productNameSnapshot: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
    };
  });
  const totalAmount = snapshots.reduce((sum, item) => sum + item.subtotal, 0);
  if (totalAmount > 2147483647)
    throw new AppError(
      'ORDER_TOTAL_TOO_LARGE',
      'Order exceeds the supported amount.',
      422,
    );
  for (const product of products) {
    const quantity = items.find(
      (item) => item.productId === product.id,
    ).quantity;
    await tx.product.update({
      where: { id: product.id },
      data: { stock: { decrement: quantity }, version: { increment: 1 } },
    });
  }
  return { snapshots, totalAmount };
}
export async function settleReservations(
  tx,
  orderId,
  targetStatus,
  allowConsumed = false,
) {
  // Caller holds the order lock. All operations on its reservations use this same protocol.
  const reservations = await tx.reservation.findMany({
    where: { orderId },
    orderBy: { productId: 'asc' },
  });
  const eligible = reservations.filter(
    (r) => r.status === 'ACTIVE' || (allowConsumed && r.status === 'CONSUMED'),
  );
  if (targetStatus !== 'CONSUMED')
    await lockProducts(
      tx,
      eligible.map((r) => r.productId),
    );
  for (const reservation of eligible) {
    const changed = await tx.reservation.updateMany({
      where: { id: reservation.id, status: reservation.status },
      data: { status: targetStatus },
    });
    if (changed.count === 1 && targetStatus !== 'CONSUMED') {
      await tx.product.update({
        where: { id: reservation.productId },
        data: {
          stock: { increment: reservation.quantity },
          version: { increment: 1 },
        },
      });
    }
  }
}
