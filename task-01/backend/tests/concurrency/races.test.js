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
  makeDue,
} from '../helpers.js';
import { expireBatch } from '../../src/jobs/expiration.js';
databaseSuite();
describe('real PostgreSQL contention', () => {
  it('reclaims stock that expires while checkout waits for a product lock', async () => {
    const { product: p, order } = await reserved(1, 1);
    const cart = await cartFor(p.id);
    await db.$executeRaw`UPDATE "Reservation" SET "createdAt" = date_trunc('milliseconds', clock_timestamp()) - interval '299 seconds', "expiresAt" = date_trunc('milliseconds', clock_timestamp()) + interval '1 second' WHERE "orderId" = ${order.id}::uuid`;
    let locked;
    const ready = new Promise((resolve) => {
      locked = resolve;
    });
    const holder = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${p.id}::uuid FOR UPDATE`;
      locked();
      await tx.$queryRaw`SELECT pg_sleep(1.3)::text`;
    });
    await ready;
    const response = await api.post(`/api/carts/${cart.id}/checkout`);
    await holder;
    expect(response.status).toBe(200);
    expect(
      (await db.order.findUnique({ where: { id: order.id } })).status,
    ).toBe('EXPIRED');
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      0,
    );
  });
  it.each([
    [5, 20],
    [1, 10],
  ])(
    'stock %i with %i simultaneous checkouts never oversells',
    async (stock, customers) => {
      const p = await product(stock);
      const carts = await Promise.all(
        Array.from({ length: customers }, () => cartFor(p.id)),
      );
      const results = await Promise.all(
        carts.map((cart) => api.post(`/api/carts/${cart.id}/checkout`)),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(stock);
      expect(
        results.filter(
          (r) => r.status === 409 && r.body.error.code === 'INSUFFICIENT_STOCK',
        ),
      ).toHaveLength(customers - stock);
      expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
        0,
      );
      expect(
        (
          await db.reservation.aggregate({
            where: { status: 'ACTIVE' },
            _sum: { quantity: true },
          })
        )._sum.quantity,
      ).toBe(stock);
      expect(await db.product.count({ where: { stock: { lt: 0 } } })).toBe(0);
    },
  );
  it('ten duplicate checkouts create one order and reserve once', async () => {
    const p = await product(5);
    const cart = await cartFor(p.id);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        api.post(`/api/carts/${cart.id}/checkout`),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(
      results.filter(
        (r) => r.status === 409 && r.body.error.code === 'DUPLICATE_ORDER',
      ),
    ).toHaveLength(9);
    expect(await db.order.count()).toBe(1);
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      4,
    );
  });
  it.each(['success', 'failure', 'timeout'])(
    'duplicate concurrent %s payments process once',
    async (outcome) => {
      const { product: p, order } = await reserved();
      const key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 10 }, () => pay(order.id, outcome, key)),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(
        results.filter(
          (r) => r.status === 409 && r.body.error.code === 'DUPLICATE_PAYMENT',
        ),
      ).toHaveLength(9);
      expect(await db.payment.count()).toBe(1);
      expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
        outcome === 'success' ? 8 : 10,
      );
    },
  );
  it.each(['success', 'failure'])(
    'expiry racing %s leaves one consistent terminal state',
    async (outcome) => {
      const { product: p, order } = await reserved();
      await makeDue(order.id);
      await Promise.all([pay(order.id, outcome), expireBatch(), expireBatch()]);
      const final = await db.order.findUnique({
        where: { id: order.id },
        include: { reservations: true, payment: true },
      });
      expect(final.status).toBe('EXPIRED');
      expect(final.reservations.every((r) => r.status === 'EXPIRED')).toBe(
        true,
      );
      expect(final.payment).toBeNull();
      expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
        10,
      );
    },
  );
  it('payment waiting on an order lock checks fresh database time', async () => {
    const { product: p, order } = await reserved();
    await db.$executeRaw`UPDATE "Reservation" SET "createdAt" = date_trunc('milliseconds', clock_timestamp()) - interval '299 seconds', "expiresAt" = date_trunc('milliseconds', clock_timestamp()) + interval '1 second' WHERE "orderId" = ${order.id}::uuid`;
    let locked;
    const ready = new Promise((resolve) => {
      locked = resolve;
    });
    const holder = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id}::uuid FOR UPDATE`;
      locked();
      await tx.$queryRaw`SELECT pg_sleep(1.3)::text`;
    });
    await ready;
    const response = await pay(order.id);
    await holder;
    expect(response.status).toBe(409);
    expect(
      (await db.order.findUnique({ where: { id: order.id } })).status,
    ).toBe('EXPIRED');
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      10,
    );
  });
  it('simultaneous cancellations of a paid order refund inventory once', async () => {
    const { product: p, order } = await reserved();
    await pay(order.id);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        api.post(`/api/orders/${order.id}/cancel`),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      10,
    );
  });
  it('opposite cart item order acquires product locks consistently', async () => {
    const a = await product(1);
    const b = await product(1);
    const first = await cartFor(a.id);
    const second = await cartFor(b.id);
    await api
      .post(`/api/carts/${first.id}/items`)
      .send({ productId: b.id, quantity: 1 });
    await api
      .post(`/api/carts/${second.id}/items`)
      .send({ productId: a.id, quantity: 1 });
    const results = await Promise.all(
      [first, second].map((c) => api.post(`/api/carts/${c.id}/checkout`)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await db.product.findMany()).every((p) => p.stock === 0)).toBe(
      true,
    );
  });
});
