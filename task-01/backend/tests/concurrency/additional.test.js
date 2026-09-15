import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  api,
  db,
  databaseSuite,
  product,
  cartFor,
  reserved,
  pay,
} from '../helpers.js';
import { expireBatch } from '../../src/jobs/expiration.js';
databaseSuite();
describe('cross-operation races', () => {
  it('rejects stale stock edits after checkout', async () => {
    const p = await product(5);
    const cart = await cartFor(p.id, 2);
    await api.post(`/api/carts/${cart.id}/checkout`);
    const response = await api
      .patch(`/api/products/${p.id}`)
      .send({ stock: 5, expectedVersion: p.version });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('STALE_PRODUCT');
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      3,
    );
  });
  it('cart edits and checkout serialize to one correct snapshot', async () => {
    const p = await product(10);
    const cart = await cartFor(p.id);
    const item = await db.cartItem.findFirst({ where: { cartId: cart.id } });
    const [edit, checkout] = await Promise.all([
      api.patch(`/api/carts/${cart.id}/items/${item.id}`).send({ quantity: 3 }),
      api.post(`/api/carts/${cart.id}/checkout`),
    ]);
    expect(checkout.status).toBe(200);
    expect([200, 409]).toContain(edit.status);
    const quantity = checkout.body.data.items[0].quantity;
    expect(quantity).toBe(edit.status === 200 ? 3 : 1);
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      10 - quantity,
    );
  });
  it('a globally reused payment key cannot pay two different orders', async () => {
    const a = await reserved();
    const b = await reserved();
    const key = randomUUID();
    const results = await Promise.all([
      pay(a.order.id, 'success', key),
      pay(b.order.id, 'success', key),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db.payment.count()).toBe(1);
    expect(await db.order.count({ where: { status: 'PAID' } })).toBe(1);
  });
  it('different simultaneous payment keys still create one payment per order', async () => {
    const { order } = await reserved();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => pay(order.id)),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    expect(await db.payment.count()).toBe(1);
  });
  it.each(['success', 'failure'])(
    'payment %s just before expiry remains consistent with cleanup',
    async (outcome) => {
      const { product: p, order } = await reserved();
      await db.$executeRaw`UPDATE "Reservation" SET "createdAt" = statement_timestamp() - interval '299.95 seconds', "expiresAt" = statement_timestamp() + interval '0.05 seconds' WHERE "orderId" = ${order.id}::uuid`;
      await Promise.all([pay(order.id, outcome), expireBatch()]);
      await db.$queryRaw`SELECT pg_sleep(0.06)::text`;
      await expireBatch();
      const final = await db.order.findUnique({
        where: { id: order.id },
        include: { reservations: true },
      });
      expect(
        outcome === 'success' ? ['PAID', 'EXPIRED'] : ['FAILED', 'EXPIRED'],
      ).toContain(final.status);
      const stock = (await db.product.findUnique({ where: { id: p.id } }))
        .stock;
      expect(stock).toBe(final.status === 'PAID' ? 8 : 10);
      expect(final.reservations[0].status).toBe(
        { PAID: 'CONSUMED', FAILED: 'RELEASED', EXPIRED: 'EXPIRED' }[
          final.status
        ],
      );
    },
  );
});
