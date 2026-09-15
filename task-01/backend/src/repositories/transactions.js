import { Prisma } from '@prisma/client';
import { db } from '../config/db.js';
import { requireValue } from '../utils/errors.js';
export async function transaction(work) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, {
        maxWait: 20000,
        timeout: 20000,
        isolationLevel: 'ReadCommitted',
      });
    } catch (error) {
      const retryable =
        error.code === 'P2034' || ['40P01', '40001'].includes(error.meta?.code);
      if (!retryable || attempt >= 2) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 25 * (attempt + 1) + Math.random() * 25),
      );
    }
  }
}
export async function lockCart(tx, id) {
  const rows =
    await tx.$queryRaw`SELECT * FROM "Cart" WHERE id = ${id}::uuid FOR UPDATE`;
  return requireValue(rows[0], 'CART_NOT_FOUND', 'Cart not found.');
}
export async function lockOrder(tx, id) {
  const rows =
    await tx.$queryRaw`SELECT * FROM "Order" WHERE id = ${id}::uuid FOR UPDATE`;
  return requireValue(rows[0], 'ORDER_NOT_FOUND', 'Order not found.');
}
export async function lockProducts(tx, ids) {
  if (!ids.length) return [];
  return tx.$queryRaw(
    Prisma.sql`SELECT * FROM "Product" WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
}
export async function databaseNow(tx) {
  // CURRENT_TIMESTAMP is the transaction start time; this must be evaluated AFTER lock waits.
  const [row] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
  return row.now;
}
export const orderInclude = { items: true, reservations: true, payment: true };
export function readOrder(tx, id) {
  return tx.order.findUnique({ where: { id }, include: orderInclude });
}
