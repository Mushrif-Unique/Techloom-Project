import { db } from '../config/db.js';
import {
  transaction,
  lockOrder,
  databaseNow,
  readOrder,
} from '../repositories/transactions.js';
import { settleReservations } from './inventory.js';
import { transition } from '../constants/lifecycle.js';
import { logger } from '../utils/logger.js';
export async function expireIfDue(tx, order) {
  if (order.status !== 'RESERVED') return false;
  const now = await databaseNow(tx);
  const due = await tx.reservation.findFirst({
    where: { orderId: order.id, status: 'ACTIVE', expiresAt: { lte: now } },
  });
  if (!due) return false;
  await settleReservations(tx, order.id, 'EXPIRED');
  await transition(tx, order, 'EXPIRED');
  return true;
}
export async function getOrder(id) {
  const result = await transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    await expireIfDue(tx, order);
    return readOrder(tx, id);
  });
  return result;
}
export async function listOrders({ page, limit }) {
  const where = {};
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.order.count({ where }),
  ]);
  const data = [];
  for (const order of orders) data.push(await getOrder(order.id));
  return { orders: data, total, page, limit };
}
export async function cancelOrder(id) {
  const result = await transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (order.status === 'CANCELLED') return readOrder(tx, id);
    if (await expireIfDue(tx, order))
      return { expired: true, order: await readOrder(tx, id) };
    // Validate before stock manipulation; failed transitions roll back the complete transaction.
    await transition(tx, order, 'CANCELLED');
    await settleReservations(tx, id, 'RELEASED', order.status === 'PAID');
    return readOrder(tx, id);
  });
  logger.info(
    { event: 'cancellation', orderId: id, status: result.status ?? 'EXPIRED' },
    'Cancellation handled',
  );
  return result;
}
export async function dashboard() {
  const recent = await db.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true },
  });
  const recentOrders = [];
  for (const order of recent) recentOrders.push(await getOrder(order.id));
  // Read counters after lazy expiry so this response includes its own stock restorations.
  const now = await databaseNow(db);
  const [products, stock, activeReservations] = await Promise.all([
    db.product.count({ where: { isActive: true } }),
    db.product.aggregate({ where: { isActive: true }, _sum: { stock: true } }),
    db.reservation.groupBy({
      by: ['orderId'],
      where: { status: 'ACTIVE', expiresAt: { gt: now } },
    }),
  ]);
  return {
    products,
    availableStock: stock._sum.stock ?? 0,
    activeReservations: activeReservations.length,
    recentOrders,
  };
}
